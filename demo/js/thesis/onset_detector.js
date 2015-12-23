'use strict';

onsetDetector = {
    updateOnsets: function (signal) {
        onsetDetector.detect(onsetDetectorFrameSize, framesOverlap, signal, sampleRate);
    },
    detect: function (frameSize, overlap, buffer, sampleRate) { //7
        var numberOfFrames = Math.floor(buffer.length / frameSize);
        hammingWindow = this.preprocessing.generateHamming(frameSize);
        frameStart = 0;
        var windowedFrame = [];
        var fftFrame = null;
        var detectFrame = null;
        var tempFrame = null;
        var tempFrame_2 = null;
        for (var frameNumber = 0; frameNumber < numberOfFrames; frameNumber++) {
            // PRE-PROCESSING
            windowedFrame = this.preprocessing.windowing(buffer, frameSize);
            var zeroPaddedFrame = this.preprocessing.zeroPad(windowedFrame);
            tempFrame_2 = tempFrame;
            tempFrame = fftFrame;
            // in order to achive zero padding the fft frame must be bigger than the input frame 
            // so i multiply the fft frame with 2 and i add zeros to the second half of the signal
            fftFrame = this.preprocessing.fft(zeroPaddedFrame, frameSize * 2, sampleRate);
            // DETECTION FUNCTIONS
            if (tempFrame === null) {
                detectFrame = null;
                detectFrame = this.detectionMethods.highFrequencyContent(fftFrame);
            } else if (tempFrame_2 === null && tempFrame !== null) {
                detectFrame = this.detectionMethods.spectralDifference(fftFrame, tempFrame);
            } else if (tempFrame_2 !== null && tempFrame !== null) {
                detectFrame = this.detectionMethods.phaseDeviation(tempFrame_2, tempFrame, fftFrame);
            }
            frameStart = frameStart + frameSize - (frameSize * overlap);
        }
        // import the values in an unnormalized array to avoid renormalize of the old array
        unNormalizedOutput.push(detectFrame);
        // POST-PROCESSING
        // NORMALIZATION
        normalizeWorker.postMessage({array: JSON.stringify(unNormalizedOutput), type: "last"});
        finalOutput = normalizedOutput.lastNormalize;
        // RUNNING/MOVING MEDIAN - THRESHOLDING - https://github.com/mikolalysenko/moving-median
        dynamicThresholds = onsetDetector.postprocessing.runningMedian(3, finalOutput);
        BPM = this.bpm(finalOutput, dynamicThresholds);
        document.getElementById('bpm-indicator').innerHTML = "<kbd>" + BPM + " BPM</kbd>";
    },
    bpm: function (signal, dynamicThresholds) {
// PEAK-PICKING
        var thresholded = onsetDetector.peakPicker.dynamicThresholdPicking(signal, dynamicThresholds);
        onsets = thresholded.onsetArray;
        var intervals = this.CountIntervalsBetweenNearbyPeaks(onsets);
        var groups = this.GroupNeighborsByTempo(intervals, audioContext.sampleRate);
        bpmTop = groups.sort(function (intA, intB) {
            return intB.count - intA.count;
        }).splice(0, 5);
        // summarize the tempos from each cycle in an array and then find the most common
        try {
            if (!isNaN(bpmTop[0].tempo)) {
                cycleTempos.push((bpmTop[0].tempo));
            }
            dominantTempo = Math.max.apply(Math, cycleTempos);
            if (!isNaN(dominantTempo)) {
                BPM = dominantTempo;
                return dominantTempo.toFixed(1);
            }

        } catch (err) {
        }
    },
    peakPicker: {
        dynamicThresholdPicking: function (signal, thresholds) {
            var onsetArray = [];
            var thresholdedSignal = [];
            for (var i = 0; i < signal.length; ++i) {
                if ((signal[i] > thresholds[i]) && (signal[i - 1] <= signal[i] <= signal[i + 1])) {
                    thresholdedSignal[i] = 1000;
                    onsetArray.push(i);
                    // to avoid map as onset the second occuring event in the same note which pass these conditions
                    i = i + 10;
                }
                else
                    thresholdedSignal[i] = 0;
            }
            return {onsetArray: onsetArray, thresholdedSignal: thresholdedSignal};
        },
    },
    CountIntervalsBetweenNearbyPeaks: function (peaks) {//// // Function used to return a histogram of peak intervals
        var intervalCounts = [];
        peaks.forEach(function (peak, index) {
            for (var i = 0; i < 10; i++) {
                var interval = peaks[index + i] - peak;

                var foundInterval = intervalCounts.some(function (intervalCount) {
                    if (intervalCount.interval === interval)
                        return intervalCount.count++;
                });

                if (!foundInterval) {
                    intervalCounts.push({
                        interval: interval,
                        count: 1
                    });
                }
            }
        });
        return intervalCounts;
    },
    GroupNeighborsByTempo: function (intervalCounts) {//// Function used to return a histogram of tempo candidates.
        var tempoCounts = [];
        intervalCounts.forEach(function (intervalCount, i) {
            if (intervalCount.interval !== 0) {
//                if (finalOutputSampleRate > 0 && finalOutputSampleRate === 40)
                if (finalOutputSampleRate > 0)
                    var theoreticalTempo = 60 / (intervalCount.interval / finalOutputSampleRate); // finalOutputSampleRate tixainei na isoutai me ta fps tou reqanimframe
                // Adjust the tempo to fit within the 90-180 BPM range
                while (theoreticalTempo < 80)
                    theoreticalTempo *= 2;
                while (theoreticalTempo > 180)
                    theoreticalTempo /= 2;
                var foundTempo = tempoCounts.some(function (tempoCount) {
                    if (tempoCount.tempo === theoreticalTempo)
                        return tempoCount.count += intervalCount.count;
                });
                if (!foundTempo) {
                    tempoCounts.push({
                        tempo: theoreticalTempo,
                        count: intervalCount.count
                    });
                }
            }
        });

        return tempoCounts;
    },
    preprocessing: {
        generateHamming: function (frameSize) {
            var currentHammming = new Float32Array(frameSize);
            for (var i = 0; i < frameSize; i++) {
                currentHammming[i] = WindowFunction.Hamming(frameSize, i);
            }
            return currentHammming;
        },
        windowing: function (buffer, frameSize) {
            var frameOutput = [];

            for (var i = frameStart; i < frameStart + frameSize; i++) {
                frameOutput[i - frameStart] = buffer[i] * hammingWindow[i - frameStart];
            }

            return frameOutput;
        },
        realTimeNormalizeProcessor: function (inputArray) {
            var array = onsetDetector.preprocessing.normalize(inputArray);
            return array;
        },
        zeroPad: function zeroPad(float32Signal) {                              // Zeros will be padded on both sides(?) of the window, if the window size is less than the size of the FFT section
            var width = Math.pow(2, (Math.ceil(Math.log(float32Signal.length) / Math.log(2))));
            var zeros = new Array(width).fill(0);                               // this is a personal implementation of zero padding i add a 0 filled array next to the signal and we have the double lenght array now for the fft , thats why i multiply the fft frame size with 2
            var paddedSignal = new Float32Array(width * 2);
            paddedSignal.set(float32Signal);
            paddedSignal.set(zeros, width);
            return paddedSignal;
        },
        fft: function (float32Signal, bufferSize, sampleRate) {
            var fft = new FFT(bufferSize, sampleRate);
            fft.forward(float32Signal);
            var results = [];
            for (var i = 0; i < bufferSize; i++) {
                results[i] = new Complex(fft.real[i], fft.imag[i]);
            }
            return results;
        }
    },
    detectionMethods: {
        highFrequencyContent: function (frame) {
            var sampleRate = audioContext.sampleRate;
            var fplot0 = -1 * sampleRate / 2;
            var interval = sampleRate / frame.length;
            var sum = 0;
            for (var i = 0; i < frame.length; i++) {
                var fplot = fplot0 + i * interval;
                sum += Math.pow(frame[i].multiply(fplot).magnitude(), 2) / 100000000000;
            }
            return sum;
        },
        spectralDifference: function (frame, frame_1) {
            var sum = 0;
            for (var i = 0; i < frame.length; i++) {
                var spectDiff = frame_1[i].magnitude() - frame[i].magnitude();
                spectDiff = Math.pow((spectDiff + Math.abs(spectDiff)) / 2, 2);
                sum += spectDiff / 10000000000;
            }
            return sum;
        },
        phaseDeviation: function (frame_2, frame_1, frame) {
            var sum = 0;
            for (var i = 0; i < frame.length; i++) {
                var phi = frame[i].angle() - 2 * frame[i].angle() + frame[2].angle();
                sum += Math.abs(phi);
            }
            return (sum / frame.length);
        }
    },
    postprocessing: {
        runningMedian: function (filterWidth, signal) {
            var median = createMedianFilter(filterWidth);
            var dynamicThresholds = [];
            var d = 0;
            var l = 3;
            for (var i = 0; i < signal.length; ++i) {
                dynamicThresholds[i] = (d + l) * median(signal[i]);                  // d -> constant threshold , l -> positive constant
            }
            return dynamicThresholds;
        }
    },
};