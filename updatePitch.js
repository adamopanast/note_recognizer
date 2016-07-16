//  This file is part of Toneroll.
//
//    Toneroll is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    Toneroll is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with Toneroll.  If not, see <http://www.gnu.org/licenses/>.
//
//Copyright 2015 Fragkopoulos Markos - exog3n@gmail.com

'use strict';


var prevCorrelation = {bestCorrelation: 0, potentialCorrelation: 0, confident: false, rms: 0};

function autoCorrelate(pitchAnalyserTempBuf, sampleRate) {

    var MIN_SAMPLES = 4;
    var SIZE = pitchAnalyserTempBuf.length / 2;
    var MAX_SAMPLES = pitchAnalyserTempBuf.length / 2;
    var best_offset = -1;
    var best_correlation = 0;
    var rms = 0;
    var foundGoodCorrelation = false;


//    var localMaxima = [];
//    var correlations = [];
//    var bestCorrelations = [];
//    var calibratedCorrelations = {
//        bestCorrelation: null,
//        bestOffset: null,
//        calibrated: {strong: [], medium: [], weak: []},
//        finalDecision: function () {
//        }};
//    var calibratedResult = function (correlation, offset) {
//        var _this = this;
//        _this.correlation = correlation;
//        _this.offset = offset;
//        _this.fq = sampleRate / offset;
//    }

    if (pitchAnalyserTempBuf.length < (SIZE + MAX_SAMPLES - MIN_SAMPLES)) {
        return {fq: -1, rms: rms};  // Not enough data
    }
    for (var i = 0; i < SIZE; i++) {
        var val = (pitchAnalyserTempBuf[i] - 128) / 128;
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01)                                                             // recognize silence                                                            
        return {fq: -1, rms: rms};

    var lastCorrelation = 1;


    for (var offset = MIN_SAMPLES; offset <= MAX_SAMPLES; offset++) {
        var correlation = 0;

        for (var i = 0; i < SIZE; i++) {
            correlation += Math.abs(((pitchAnalyserTempBuf[i] - 128) / 128) - ((pitchAnalyserTempBuf[i + offset] - 128) / 128));
        }
        correlation = 1 - (correlation / SIZE);

        // store all correlations for later processing
//        correlations.push({correlation: correlation, offset: offset});


        if ((correlation > 0.90) && (correlation > lastCorrelation)) {
            foundGoodCorrelation = true;
//            bestCorrelations.push({correlation: correlation, offset: offset});

        }
        else if (foundGoodCorrelation) {
            // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
            // Now we need to tweak the offset - by interpolating between the values to the left and right of the
            // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
            // we need to do a curve fit on correlations[] around best_offset in order to better determine precise
            // (anti-aliased) offset.

            // we know best_offset >=1, 
            // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and 
            // we can't drop into this clause until the following pass (else if).
            // 
            // this is when a max correlation exist (whaen we have the max energy in correlation - when the two comparative signals are totaly overlaped)

//            console.log(findLocalMaxima(correlations));
            return {fq: sampleRate / best_offset, rms: rms};
        }

        lastCorrelation = correlation;


        if (correlation > best_correlation) {
            best_correlation = correlation;
            best_offset = offset;
//            calibratedCorrelations.bestCorrelation = correlation;
//            calibratedCorrelations.bestOffset = offset;
//            calibratedCorrelations.calibrated.strong.push(new calibratedResult(correlation, offset));
        }
//        else if (correlation > 0.7) {
//            calibratedCorrelations.calibrated.strong.push(new calibratedResult(correlation, offset));
//        } else if (correlation > 0.5) {
//            calibratedCorrelations.calibrated.medium.push(new calibratedResult(correlation, offset));
//        } else if (correlation > 0.3) {
//            calibratedCorrelations.calibrated.weak.push(new calibratedResult(correlation, offset));
//        }
    }
    if (best_correlation > 0.01) {
// console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
        return {fq: sampleRate / best_offset, rms: rms};
    }
    return {fq: -1, rms: rms};
    //	var best_frequency = sampleRate/best_offset;
}

self.addEventListener('message', function (e) {
    var ac = autoCorrelate(e.data.array, e.data.samples);
    var thisCorrelation = {bestCorrelation: ac.fq, potentialCorrelation: 0, confident: false, rms: ac.rms};
    thisCorrelation = checkResult(thisCorrelation);
    prevCorrelation = thisCorrelation;
    self.postMessage(thisCorrelation);
}, false);

function checkResult(thisCorrelation) {
    var offPitch = Math.abs(centsOffFromPitch(thisCorrelation.bestCorrelation, noteFromPitch(thisCorrelation.bestCorrelation))) || -1;
//    console.log(offPitch);
    if (offPitch > 50) {
        thisCorrelation.confident = false;
        console.log('pass?');
        try {
            if (prevCorrelation.confident)
                thisCorrelation.potentialCorrelation = prevCorrelation.bestCorrelation;
        } catch (e) {
        }
    } else {
        thisCorrelation.confident = true;
    }
    return thisCorrelation;
}

function noteFromPitch(frequency) {
    var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69; // for 8 octaves
}
function centsOffFromPitch(frequency, note) {
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
    function frequencyFromNoteNumber(note) {
        return 440 * Math.pow(2, (note - 69) / 12); // for 8 octaves
    }
}


//function findLocalMaxima(correlations) {
//    var localMaxima = [];
//    var medianed = runningMedian(correlations);
//    for (var j = 0; j < medianed.length; j++) {
//        console.log(medianed[j].correlation);
//    }
//    for (var i = 1; i < medianed.length - 1; i++) {
//
////        console.log('mn');
////        console.log(medianed[i - 1].correlation);
////        console.log(medianed[i].correlation);
////        console.log(medianed[i + 1].correlation);
//
//        if (medianed[i - 1].correlation < medianed[i].correlation && medianed[i].correlation > medianed[i + 1].correlation) {
//
//            localMaxima.push(medianed[i]);
//        }
//
//    }
//    return localMaxima;
//}
//
//function runningMedian(correlations) {
//    var median = createMedianFilter(7);
//    var medianedCorrealtions = [];
//    var d = 0;
//    var l = 1;
//    for (var i = 0; i < correlations.length; ++i) {
//        medianedCorrealtions[i] = {correlation: (d + l) * median(correlations[i].correlation), offset: correlations[i].offset};
//    }
//    return medianedCorrealtions;
//}
//function createMedianFilter(length) {
//    var buffer = new Float64Array(length);
//    var history = new Int32Array(length);
//    var counter = 0;
//    var bufCount = 0;
//    function insertItem(x) {
//        var nextCounter = counter++;
//        var oldCounter = nextCounter - length;
//
//        //First pass:  Remove all old items
//        var ptr = 0;
//        for (var i = 0; i < bufCount; ++i) {
//            var c = history[i];
//            if (c <= oldCounter) {
//                continue
//            }
//            buffer[ptr] = buffer[i];
//            history[ptr] = c;
//            ptr += 1;
//        }
//        bufCount = ptr;
//
//        //Second pass:  Insert x
//        if (!isNaN(x)) {
//            var ptr = bufCount;
//            for (var j = bufCount - 1; j >= 0; --j) {
//                var y = buffer[j];
//                if (y < x) {
//                    buffer[ptr] = x;
//                    history[ptr] = nextCounter;
//                    break
//                }
//                buffer[ptr] = y;
//                history[ptr] = history[j];
//                ptr -= 1;
//            }
//            if (j < 0) {
//                buffer[0] = x;
//                history[0] = nextCounter;
//            }
//            bufCount += 1;
//        }
//
//        //Return median
//        if (!bufCount) {
//            return NaN;
//        } else if (bufCount & 1) {
//            return buffer[bufCount >>> 1];
//        } else {
//            var mid = bufCount >>> 1;
//            return 0.5 * (buffer[mid - 1] + buffer[mid]);
//        }
//    }
//    return insertItem;
//}

