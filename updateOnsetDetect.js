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
var unNormalizedOutput = [];
var onsetDetector = {
    detect: function (frameSize, overlap, buffer, sampleRate) {

// TODO : cut the beginning of the array when get big - performance (below works well) - BUT also the next arrays must now the current offset for correct results, 
// also onsets must push to the center array not recreate the whole array
//        if (unNormalizedOutput.length > 256) {
//            unNormalizedOutput = unNormalizedOutput.slice(128, unNormalizedOutput.length);
//        }

        var numberOfFrames = Math.floor(buffer.length / frameSize);
        var hammingWindow = this.preprocessing.generateHamming(frameSize);
        var frameStart = 0;
        var windowedFrame = [];
        var fftFrame = null;
        var detectFrame = null;
        var tempFrame = null;
        var tempFrame_2 = null;

        for (var frameNumber = 0; frameNumber < numberOfFrames; frameNumber++) {
            // PRE-PROCESSING
            windowedFrame = this.preprocessing.windowing(buffer, frameSize, hammingWindow, frameStart);
            var zeroPaddedFrame = this.preprocessing.zeroPad(windowedFrame);

            tempFrame_2 = tempFrame;
            tempFrame = fftFrame;
            // in order to achive zero padding the fft frame must be bigger than the input frame 
            // so i multiply the fft frame with 2 and i add zeros to the second half of the signal
            fftFrame = this.preprocessing.fft(zeroPaddedFrame, frameSize * 2, sampleRate);
            // DETECTION FUNCTIONS
            if (tempFrame === null) {
                detectFrame = null;
                detectFrame = this.detectionMethods.highFrequencyContent(fftFrame, sampleRate);
            } else if (tempFrame_2 === null && tempFrame !== null) {
                detectFrame = this.detectionMethods.spectralDifference(fftFrame, tempFrame);
            } else if (tempFrame_2 !== null && tempFrame !== null) {
                detectFrame = this.detectionMethods.phaseDeviation(tempFrame_2, tempFrame, fftFrame);
            }
            frameStart = frameStart + frameSize - (frameSize * overlap);
        }
        return detectFrame;
    },
    preprocessing: {
        generateHamming: function (frameSize) {
            var currentHammming = new Float32Array(frameSize);
            for (var i = 0; i < frameSize; i++) {
                currentHammming[i] = WindowFunction.Hamming(frameSize, i);
            }
            return currentHammming;
        },
        windowing: function (buffer, frameSize, hammingWindow, frameStart) {
            var frameOutput = [];

            for (var i = frameStart; i < frameStart + frameSize; i++) {
                frameOutput[i - frameStart] = buffer[i] * hammingWindow[i - frameStart];
            }

            return frameOutput;
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
        highFrequencyContent: function (frame, sampleRate) {
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
};

// DSP library elements
var DSP = {
    // Channels
    LEFT: 0,
    RIGHT: 1,
    MIX: 2,
    // Waveforms
    SINE: 1,
    TRIANGLE: 2,
    SAW: 3,
    SQUARE: 4,
    // Filters
    LOWPASS: 0,
    HIGHPASS: 1,
    BANDPASS: 2,
    NOTCH: 3,
    // Window functions
    BARTLETT: 1,
    BARTLETTHANN: 2,
    BLACKMAN: 3,
    COSINE: 4,
    GAUSS: 5,
    HAMMING: 6,
    HANN: 7,
    LANCZOS: 8,
    RECTANGULAR: 9,
    TRIANGULAR: 10,
    // Loop modes
    OFF: 0,
    FW: 1,
    BW: 2,
    FWBW: 3,
    // Math
    TWO_PI: 2 * Math.PI
};
function WindowFunction(type, alpha) {
    this.alpha = alpha;
    switch (type) {
        case DSP.HAMMING:
            this.func = WindowFunction.Hamming;
            break;
    }
}
WindowFunction.prototype.process = function (buffer) {
    var length = buffer.length;
    for (var i = 0; i < length; i++) {
        buffer[i] *= this.func(length, i, this.alpha);
    }
    return buffer;
};
WindowFunction.Hamming = function (length, index) {
    return 0.54 - 0.46 * Math.cos(DSP.TWO_PI * index / (length - 1));
};
function FourierTransform(bufferSize, sampleRate) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.bandwidth = 2 / bufferSize * sampleRate / 2;

    this.spectrum = new Float32Array(bufferSize / 2);
    this.real = new Float32Array(bufferSize);
    this.imag = new Float32Array(bufferSize);

    this.peakBand = 0;
    this.peak = 0;

    /**
     * Calculates the *middle* frequency of an FFT band.
     *
     * @param {Number} index The index of the FFT band.
     *
     * @returns The middle frequency in Hz.
     */
    this.getBandFrequency = function (index) {
        return this.bandwidth * index + this.bandwidth / 2;
    };

    this.calculateSpectrum = function () {
        var spectrum = this.spectrum,
                real = this.real,
                imag = this.imag,
                bSi = 2 / this.bufferSize,
                sqrt = Math.sqrt,
                rval,
                ival,
                mag;

        for (var i = 0, N = bufferSize / 2; i < N; i++) {
            rval = real[i];
            ival = imag[i];
            mag = bSi * sqrt(rval * rval + ival * ival);

            if (mag > this.peak) {
                this.peakBand = i;
                this.peak = mag;
            }

            spectrum[i] = mag;
        }
    };
}
function FFT(bufferSize, sampleRate) {
    FourierTransform.call(this, bufferSize, sampleRate);

    this.reverseTable = new Uint32Array(bufferSize);

    var limit = 1;
    var bit = bufferSize >> 1;

    var i;

    while (limit < bufferSize) {
        for (i = 0; i < limit; i++) {
            this.reverseTable[i + limit] = this.reverseTable[i] + bit;
        }

        limit = limit << 1;
        bit = bit >> 1;
    }

    this.sinTable = new Float32Array(bufferSize);
    this.cosTable = new Float32Array(bufferSize);

    for (i = 0; i < bufferSize; i++) {
        this.sinTable[i] = Math.sin(-Math.PI / i);
        this.cosTable[i] = Math.cos(-Math.PI / i);
    }
}
FFT.prototype.forward = function (buffer) {
    // Locally scope variables for speed up
    var bufferSize = this.bufferSize,
            cosTable = this.cosTable,
            sinTable = this.sinTable,
            reverseTable = this.reverseTable,
            real = this.real,
            imag = this.imag,
            spectrum = this.spectrum;
    var k = Math.floor(Math.log(bufferSize) / Math.LN2);

    if (Math.pow(2, k) !== bufferSize) {
        throw "Invalid buffer size, must be a power of 2.";
    }
    if (bufferSize !== buffer.length) {
        throw "Supplied buffer is not the same size as defined FFT. FFT Size: " + bufferSize + " Buffer Size: " + buffer.length;
    }

    var halfSize = 1,
            phaseShiftStepReal,
            phaseShiftStepImag,
            currentPhaseShiftReal,
            currentPhaseShiftImag,
            off,
            tr,
            ti,
            tmpReal,
            i;

    for (i = 0; i < bufferSize; i++) {
        real[i] = buffer[reverseTable[i]];
        imag[i] = 0;
    }

    while (halfSize < bufferSize) {
        //phaseShiftStepReal = Math.cos(-Math.PI/halfSize);
        //phaseShiftStepImag = Math.sin(-Math.PI/halfSize);
        phaseShiftStepReal = cosTable[halfSize];
        phaseShiftStepImag = sinTable[halfSize];

        currentPhaseShiftReal = 1;
        currentPhaseShiftImag = 0;

        for (var fftStep = 0; fftStep < halfSize; fftStep++) {
            i = fftStep;

            while (i < bufferSize) {
                off = i + halfSize;
                tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
                ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

                real[off] = real[i] - tr;
                imag[off] = imag[i] - ti;
                real[i] += tr;
                imag[i] += ti;

                i += halfSize << 1;
            }

            tmpReal = currentPhaseShiftReal;
            currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
            currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
        }

        halfSize = halfSize << 1;
    }

    return this.calculateSpectrum();
};

// Complex library elements
var Complex = function (real, im) {
    this.real = real;
    this.im = im;
};
var prototype = Complex.prototype = {
    fromRect: function (a, b) {
        this.real = a;
        this.im = b;
        return this;
    },
    fromPolar: function (r, phi) {
        if (typeof r == 'string') {
            var parts = r.split(' ');
            r = parts[0];
            phi = parts[1];
        }
        return this.fromRect(
                r * Math.cos(phi),
                r * Math.sin(phi)
                );
    },
    toPrecision: function (k) {
        return this.fromRect(
                this.real.toPrecision(k),
                this.im.toPrecision(k)
                );
    },
    toFixed: function (k) {
        return this.fromRect(
                this.real.toFixed(k),
                this.im.toFixed(k)
                );
    },
    finalize: function () {
        this.fromRect = function (a, b) {
            return new Complex(a, b);
        };
        if (Object.defineProperty) {
            Object.defineProperty(this, 'real', {writable: false, value: this.real});
            Object.defineProperty(this, 'im', {writable: false, value: this.im});
        }
        return this;
    },
    magnitude: function () {
        var a = this.real, b = this.im;
        return Math.sqrt(a * a + b * b);
    },
    angle: function () {
        return Math.atan2(this.im, this.real);
    },
    conjugate: function () {
        return this.fromRect(this.real, -this.im);
    },
    negate: function () {
        return this.fromRect(-this.real, -this.im);
    },
    multiply: function (z) {
        z = Complex.from(z);
        var a = this.real, b = this.im;
        return this.fromRect(
                z.real * a - z.im * b,
                b * z.real + z.im * a
                );
    },
    divide: function (z) {
        z = Complex.from(z);
        var divident = (Math.pow(z.real, 2) + Math.pow(z.im, 2)),
                a = this.real, b = this.im;
        return this.fromRect(
                (a * z.real + b * z.im) / divident,
                (b * z.real - a * z.im) / divident
                );
    },
    add: function (z) {
        z = Complex.from(z);
        return this.fromRect(this.real + z.real, this.im + z.im);
    },
    subtract: function (z) {
        z = Complex.from(z);
        return this.fromRect(this.real - z.real, this.im - z.im);
    },
    pow: function (z) {
        z = Complex.from(z);
        var result = z.multiply(this.clone().log()).exp(); // z^w = e^(w*log(z))
        return this.fromRect(result.real, result.im);
    },
    sqrt: function () {
        var abs = this.magnitude(),
                sgn = this.im < 0 ? -1 : 1;
        return this.fromRect(
                Math.sqrt((abs + this.real) / 2),
                sgn * Math.sqrt((abs - this.real) / 2)
                );
    },
    log: function (k) {
        if (!k)
            k = 0;
        return this.fromRect(
                Math.log(this.magnitude()),
                this.angle() + k * 2 * Math.PI
                );
    },
    exp: function () {
        return this.fromPolar(
                Math.exp(this.real),
                this.im
                );
    },
    sin: function () {
        var a = this.real, b = this.im;
        return this.fromRect(
                Math.sin(a) * cosh(b),
                Math.cos(a) * sinh(b)
                );
    },
    cos: function () {
        var a = this.real, b = this.im;
        return this.fromRect(
                Math.cos(a) * cosh(b),
                Math.sin(a) * sinh(b) * -1
                );
    },
    tan: function () {
        var a = this.real, b = this.im,
                divident = Math.cos(2 * a) + cosh(2 * b);
        return this.fromRect(
                Math.sin(2 * a) / divident,
                sinh(2 * b) / divident
                );
    },
    sinh: function () {
        var a = this.real, b = this.im;
        return this.fromRect(
                sinh(a) * Math.cos(b),
                cosh(a) * Math.sin(b)
                );
    },
    cosh: function () {
        var a = this.real, b = this.im;
        return this.fromRect(
                cosh(a) * Math.cos(b),
                sinh(a) * Math.sin(b)
                );
    },
    tanh: function () {
        var a = this.real, b = this.im,
                divident = cosh(2 * a) + Math.cos(2 * b);
        return this.fromRect(
                sinh(2 * a) / divident,
                Math.sin(2 * b) / divident
                );
    },
    clone: function () {
        return new Complex(this.real, this.im);
    },
    toString: function (polar) {
        if (polar)
            return this.magnitude() + ' ' + this.angle();

        var ret = '', a = this.real, b = this.im;
        if (a)
            ret += a;
        if (a && b || b < 0)
            ret += b < 0 ? '-' : '+';
        if (b) {
            var absIm = Math.abs(b);
            if (absIm != 1)
                ret += absIm;
            ret += 'i';
        }
        return ret || '0';
    },
    equals: function (z) {
        z = Complex.from(z);
        return (z.real == this.real && z.im == this.im);
    }

};
var alias = {
    abs: 'magnitude',
    arg: 'angle',
    phase: 'angle',
    conj: 'conjugate',
    mult: 'multiply',
    dev: 'divide',
    sub: 'subtract'
};
for (var a in alias)
    prototype[a] = prototype[alias[a]];
var extend = {
    from: function (real, im) {
        if (real instanceof Complex)
            return new Complex(real.real, real.im);
        var type = typeof real;
        if (type == 'string') {
            if (real == 'i')
                real = '0+1i';
            var match = real.match(/(\d+)?([\+\-]\d*)[ij]/);
            if (match) {
                real = match[1];
                im = (match[2] == '+' || match[2] == '-') ? match[2] + '1' : match[2];
            }
        }
        real = +real;
        im = +im;
        return new Complex(isNaN(real) ? 0 : real, isNaN(im) ? 0 : im);
    },
    fromPolar: function (r, phi) {
        return new Complex(1, 1).fromPolar(r, phi);
    },
    i: new Complex(0, 1).finalize(),
    one: new Complex(1, 0).finalize()

};
for (var e in extend)
    Complex[e] = extend[e];
var sinh = function (x) {
    return (Math.pow(Math.E, x) - Math.pow(Math.E, -x)) / 2;
};
var cosh = function (x) {
    return (Math.pow(Math.E, x) + Math.pow(Math.E, -x)) / 2;
};

// Web Worker message listener
self.addEventListener('message', function (e) {
    // import the values in an unnormalized array to avoid renormalize of the old array
    unNormalizedOutput.push(onsetDetector.detect(e.data.frameSize, e.data.framesOverlap, e.data.array, e.data.samples));
    self.postMessage(unNormalizedOutput);
}, false);


