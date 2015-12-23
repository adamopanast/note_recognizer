'use strict';

function autoCorrelate(pitchAnalyserTempBuf, sampleRate) {
    var MIN_SAMPLES = 4;	// corresponds to an 11kHz signal
    var MAX_SAMPLES = 1000; // corresponds to a 44Hz signal
    var SIZE = 1000;
    var best_offset = -1;
    var best_correlation = 0;
    var rms = 0;
    var foundGoodCorrelation = false;
    if (pitchAnalyserTempBuf.length < (SIZE + MAX_SAMPLES - MIN_SAMPLES)) {
        return -1;  // Not enough data
    }
    for (var i = 0; i < SIZE; i++) {
        var val = (pitchAnalyserTempBuf[i] - 128) / 128;
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01)
        return -1;

    var lastCorrelation = 1;
    for (var offset = MIN_SAMPLES; offset <= MAX_SAMPLES; offset++) {
        var correlation = 0;

        for (var i = 0; i < SIZE; i++) {
            correlation += Math.abs(((pitchAnalyserTempBuf[i] - 128) / 128) - ((pitchAnalyserTempBuf[i + offset] - 128) / 128));
        }
        correlation = 1 - (correlation / SIZE);
        if ((correlation > 0.9) && (correlation > lastCorrelation))
            foundGoodCorrelation = true;
        else if (foundGoodCorrelation) {
            // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
            return sampleRate / best_offset;
        }
        lastCorrelation = correlation;
        if (correlation > best_correlation) {
            best_correlation = correlation;
            best_offset = offset;
        }
    }
    if (best_correlation > 0.01) {
        return sampleRate / best_offset;
    }
    return -1;
}

self.addEventListener('message', function(e) {
    var ac = autoCorrelate(e.data.array, e.data.samples);
    self.postMessage(ac);
}, false);

