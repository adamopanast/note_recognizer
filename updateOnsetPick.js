//    Toneroll is a real time music transcription tool
//    Copyright (C) 2015-2016  Markos Fragkopoulos
//    This file is part of Toneroll.
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
//    Toneroll Copyright 2015-2016 Fragkopoulos Markos - exog3n@gmail.com
//    This program comes with ABSOLUTELY NO WARRANTY; for details type `show w'.
//    This is free software, and you are welcome to redistribute it
//    under certain conditions; type `show c' for details.

'use strict';

var self = this;
var minNoteDuration = 0;
var normalizedInput = [];
var dynamicThresholds = [];
var onsets = [];
var cycle = 0;
var median = createMedianFilter(5);

var onsetDetector = {
    pick: function (inputArray, cycle, prevOnset) {
        // RUNNING/MOVING MEDIAN - THRESHOLDING - https://github.com/mikolalysenko/moving-median - over the last framesize values
        var tempThresholds = onsetDetector.postprocessing.runningMedian(inputArray);

        // push the last value to thresholds
        dynamicThresholds.push(tempThresholds[tempThresholds.length - 1]);

        var thresholded = onsetDetector.peakPicker.dynamicValueThresholdPicking(inputArray[inputArray.length - 1], tempThresholds[tempThresholds.length - 1], cycle, prevOnset);
        if (thresholded.isOnset) {
            onsets.push(thresholded.onsetCycle);
        }
        return thresholded.isOnset;
    },
    inputProcessor: function (inputArray) {
        var narrowArray = [];
        var frameSize = 24;
        for (var i = inputArray.length - frameSize; i < inputArray.length - 1; i++) {
            narrowArray.push(inputArray[i] || 0);
        }
        return narrowArray;
    },
    postprocessing: {
        runningMedian: function (signal) {
            var dynamicThresholds = [];
            var d = 0;
            var l = 3;
            for (var i = 0; i < signal.length; ++i) {
                dynamicThresholds[i] = (d + l) * median(signal[i]);                  // d -> constant threshold , l -> positive constant
            }
            return dynamicThresholds;
        }
    },
    peakPicker: {
        dynamicValueThresholdPicking: function (signal, threshold, cycle, prevOnset) {
            var isOnset = false;
            if ((signal > threshold)) {
                // to avoid map as onset the second occuring event in the same note we use prevonset position
                if (cycle - prevOnset > minNoteDuration) {
//                    console.log(cycle);
                    isOnset = true;
                } else {
                    isOnset = false;
                }
            }
            return {onsetCycle: cycle, isOnset: isOnset};
        }
    }
};

// moving-median library elements
function createMedianFilter(length) {
    var buffer = new Float64Array(length);
    var history = new Int32Array(length);
    var counter = 0;
    var bufCount = 0;
    function insertItem(x) {
        var nextCounter = counter++;
        var oldCounter = nextCounter - length;

        //First pass:  Remove all old items
        var ptr = 0;
        for (var i = 0; i < bufCount; ++i) {
            var c = history[i];
            if (c <= oldCounter) {
                continue
            }
            buffer[ptr] = buffer[i];
            history[ptr] = c;
            ptr += 1;
        }
        bufCount = ptr;

        //Second pass:  Insert x
        if (!isNaN(x)) {
            var ptr = bufCount;
            for (var j = bufCount - 1; j >= 0; --j) {
                var y = buffer[j];
                if (y < x) {
                    buffer[ptr] = x;
                    history[ptr] = nextCounter;
                    break
                }
                buffer[ptr] = y;
                history[ptr] = history[j];
                ptr -= 1;
            }
            if (j < 0) {
                buffer[0] = x;
                history[0] = nextCounter;
            }
            bufCount += 1;
        }

        //Return median
        if (!bufCount) {
            return NaN;
        } else if (bufCount & 1) {
            return buffer[bufCount >>> 1];
        } else {
            var mid = bufCount >>> 1;
            return 0.5 * (buffer[mid - 1] + buffer[mid]);
        }
    }
    return insertItem;
}

// Web Worker message listener
self.addEventListener('message', function (e) {
    minNoteDuration = e.data.minNoteDuration;
    // pushed the last normalized value passed on worker
    normalizedInput.push(e.data.normalized);
    cycle = e.data.currentCycle;
    var prevOnset = onsets[onsets.length - 1] || 0;
    // narrow down the array and sent it for picking
    var onset = onsetDetector.pick(onsetDetector.inputProcessor(normalizedInput, cycle), cycle, prevOnset);


    // return onsets
    self.postMessage(onset);
}, false);


