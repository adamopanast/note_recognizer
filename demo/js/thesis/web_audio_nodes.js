'use strict';
audioUsher = {
    webAudioInit: {
        micInit: {
            toggleMicSource: function () {
                micSelected = true;
                sampleSelected = false;
                if (!navigator.getUserMedia)
                    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                            navigator.mozGetUserMedia || navigator.msGetUserMedia;
                if (navigator.getUserMedia) {
                    navigator.getUserMedia({"audio": {"mandatory": {"googEchoCancellation": "false", "googAutoGainControl": "false", "googNoiseSuppression": "false", "googHighpassFilter": "false"}, "optional": []}}, success, function (e) {
                        alert('Error capturing audio.');
                    });
                } else
                    alert('getUserMedia not supported in this browser.');
                function success(e) {
                    if (isPlaying) {
                        //stop playing and return
                        sourceNode.stop(0);
                        sourceNode.disconnect(0);
                        isPlaying = false;
                        drawer.clearCanvas();
                        audioUsher.webAudioInit.processNodes.clearNodes();
                    }
                    mediaStreamSource = audioContext.createMediaStreamSource(e);
                    audioUsher.webAudioInit.processNodes.initialize();
                    audioUsher.connector.connectNodes();
                }
                isRecording = true;
                actions.process();
            }
        },
        sampleInit: {
            toggleSampleSource: function () {
                micSelected = false;
                sampleSelected = true;
                if (isRecording) {
                    mediaStreamSource.disconnect(0);
                    mediaStreamSource = null;
                    isRecording = false;
                    drawer.clearCanvas();
                    audioUsher.webAudioInit.processNodes.clearNodes();
                }
            }
        },
        processNodes: {
            initialize: function () {
                if (sampleSelected) {
                    audioUsher.webAudioInit.processNodes.sourceInit();
                }
                audioUsher.webAudioInit.processNodes.limiterInit();
                audioUsher.webAudioInit.processNodes.initInstrumentEQ();
                audioUsher.webAudioInit.processNodes.pitchAnalyserInit();
                audioUsher.webAudioInit.processNodes.compressorInit();
                audioUsher.webAudioInit.processNodes.onsetCompressorInit();
                audioUsher.webAudioInit.processNodes.filterInit();
                audioUsher.webAudioInit.processNodes.onsetAnalyserInit();
            },
            sourceInit: function () {
                sourceNode = audioContext.createBufferSource();
                sourceNode.buffer = theBuffer;
                sourceNode.loop = false;
            },
            limiterInit: function () {
                limiterLabel = document.getElementById('limiter-maximize-db');
                limiterReduction = document.getElementById('limiter-reduction');
                preGainNode = audioContext.createGain();
                limiterNode = audioContext.createDynamicsCompressor();
                limiterNode.threshold.value = 0.0; // this is the pitfall, leave some headroom
                limiterNode.knee.value = 0.0; // brute force
                limiterNode.ratio.value = 20.0; // max compression
                limiterNode.attack.value = 0.005; // 5ms attack
                limiterNode.release.value = 0.050; // 50ms release

            },
            pitchAnalyserInit: function () {
                pitchAnalyserNode = null;
                pitchAnalyserNode = audioContext.createAnalyser();
                pitchAnalyserNode.fftSize = 2048;
                pitchAnalyserNode.smoothingTimeConstant = 1; // not sure for its value - the default analyser value for this is 0.8
                pitchAnalyserTempBuf = new Uint8Array(pitchAnalyserBuflen);
            },
            compressorInit: function () {                                       // i can use one preset per instrument - piano preset by default
                compressorNode = audioContext.createDynamicsCompressor();
                compressorNode.threshold.value = -10;
                compressorNode.knee.value = 6;
                compressorNode.ratio.value = 6;
                compressorNode.reduction.value = 10;
                compressorNode.attack.value = 40;
                compressorNode.release.value = 200;
            },
            onsetCompressorInit: function () {                                       // i can use one preset per instrument if helps onsetdetection etc
                onsetCompressorNode = audioContext.createDynamicsCompressor();
                onsetCompressorNode.threshold.value = -20;
                onsetCompressorNode.knee.value = 6;
                onsetCompressorNode.ratio.value = 6;
                onsetCompressorNode.reduction.value = 10;
                onsetCompressorNode.attack.value = 40;
                onsetCompressorNode.release.value = 70;
            },
            filterInit: function () {
                filterNode = audioContext.createBiquadFilter();
                filterNode.type = "bandpass";
                filterNode.Q.value = 0;
            },
            onsetAnalyserInit: function () {
                onsetAnalyserNode = null;
                onsetAnalyserNode = audioContext.createAnalyser();
                onsetAnalyserNode.fftSize = 2048;
                onsetAnalyserTempBuf = new Uint8Array(onsetAnalyserBuflen);
            },
            // An 8-band parametric EQ type for convenient application of filters
            ParametricEQ: function () {
                var _this = this;
                // Create a pre-gain as the input
//                _this.input = audioContext.createGain();
                // Create the bands; all are initially peaking filters
                _this.bands = [];
                for (var i = 0; i < 8; i++) {
                    var filter = audioContext.createBiquadFilter();
                    filter.type = "peaking";
                    filter.frequency.value = 64 * Math.pow(2, i);
                    filter.Q.value = 1;
                    _this.bands.push(filter);
                    // Connect consecutive bands
                    if (i > 0) {
                        _this.bands[i - 1].connect(_this.bands[i]);
                    }
                }
                // Connect the input to band 0, and set band 7 as output
//                _this.input.connect(_this.bands[0]);
                _this.input = _this.bands[0];
                _this.output = _this.bands[7];
                // Sets all band frequencies at once; freqs is a list
                _this.setBandFrequencies = function (freqs) {
                    var min = Math.min(_this.bands.length, freqs.length);
                    for (var i = 0; i < min; i++) {
                        _this.bands[i].frequency.value = freqs[i];
                    }
                };
                // Sets all band types at once; types is a list
                _this.setBandTypes = function (types) {
                    var min = Math.min(_this.bands.length, types.length);
                    for (var i = 0; i < min; i++) {
                        _this.bands[i].type = types[i];
                    }
                };
                // Sets all Q values at once; Qs is a list
                _this.setQValues = function (Qs) {
                    var min = Math.min(_this.bands.length, Qs.length);
                    for (var i = 0; i < min; i++) {
                        _this.bands[i].Q.value = Qs[i];
                    }
                };
                // Sets all gain values at once; gains is a list
                _this.setBandGains = function (gains) {
                    var min = Math.min(_this.bands.length, gains.length);
                    for (var i = 0; i < min; i++) {
                        _this.bands[i].gain.value = gains[i];
                    }
                };
            },
            initInstrumentEQ: function () {
                instrumentEQNodes = new audioUsher.webAudioInit.processNodes.ParametricEQ();
                actions.setEQPreset(initializer.settings.instruments.piano.kind.standard88Key.filter);

            },
            clearNodes: function () {
                sourceNode = null;
                mediaStreamSource = null;
                preGainNode = null;
                limiterNode = null;
                pitchAnalyserNode = null;
                compressorNode = null;
                filterNode = null;
                onsetAnalyserNode = null;
                instrumentEQNodes = null;
//                scriptProccessorNode = null;
                reducer = null;
                levelMeter = null;
                masterGain = null;
                noiseAnalyser1 = null;
                noiseAnalyser2 = null;
            },
        }
    },
    connector: {
        connectNodes: function () {
            if (micSelected) {
                mediaStreamSource.connect(compressorNode);
            }
            else if (sampleSelected) {
                sourceNode.connect(compressorNode);
            }
            // compressor
            compressorNode.connect(instrumentEQNodes.input);
            // EQ
            instrumentEQNodes.output.connect(preGainNode);
            //limiter
            preGainNode.connect(limiterNode);
            //1out
            limiterNode.connect(pitchAnalyserNode);
            //2out
            limiterNode.connect(onsetCompressorNode);
            //onsetCompressor
            onsetCompressorNode.connect(onsetAnalyserNode);
            //3out
            limiterNode.connect(audioContext.destination);
        }
    },
    applyInstrumentPresets: function (instrument) {
        switch (instrument) {
            case "piano":
                var compressorSettings = initializer.settings.instruments.piano;
                var filterSettings = initializer.settings.instruments.piano.kind.standard88Key.filter;
                break;
            case "guitar":
                var compressorSettings = initializer.settings.instruments.strings;
                var filterSettings = initializer.settings.instruments.strings.kind.guitar.filter;
                break;
            case "violin":
                var compressorSettings = initializer.settings.instruments.strings;
                var filterSettings = initializer.settings.instruments.strings.kind.violin.filter;
                break;
            case "viola":
                var compressorSettings = initializer.settings.instruments.strings;
                var filterSettings = initializer.settings.instruments.strings.kind.viola.filter;
                break;
            case "cello":
                var compressorSettings = initializer.settings.instruments.strings;
                var filterSettings = initializer.settings.instruments.strings.kind.cello.filter;
                break;
            case "bass":
                var compressorSettings = initializer.settings.instruments.strings;
                var filterSettings = initializer.settings.instruments.strings.kind.bass.filter;
                break;
            case "harp":
                var compressorSettings = initializer.settings.instruments.strings;
                var filterSettings = initializer.settings.instruments.strings.kind.harp.filter;
                break;
            case "trumpet":
                var compressorSettings = initializer.settings.instruments.brass;
                var filterSettings = initializer.settings.instruments.brass.kind.trumpet.filter;
                break;
            case "tenorTrombone":
                var compressorSettings = initializer.settings.instruments.brass;
                var filterSettings = initializer.settings.instruments.brass.kind.tenorTrombone.filter;
                break;
            case "bassTrombone":
                var compressorSettings = initializer.settings.instruments.brass;
                var filterSettings = initializer.settings.instruments.brass.kind.violin.filter;
                break;
            case "frenchHorn":
                var compressorSettings = initializer.settings.instruments.brass;
                var filterSettings = initializer.settings.instruments.brass.kind.frenchHorn.filter;
                break;
            case "tuba":
                var compressorSettings = initializer.settings.instruments.brass;
                var filterSettings = initializer.settings.instruments.brass.kind.tuba.filter;
                break;
            case "piccolo":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.piccolo.filter;
                break;
            case "flute":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.flute.filter;
                break;
            case "oboe":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.oboe.filter;
                break;
            case "clarinet":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.clarinet.filter;
                break;
            case "altoSax":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.altoSax.filter;
                break;
            case "tenorSax":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.tenorSax.filter;
                break;
            case "bassoon":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.bassoon.filter;
                break;
            case "constraBassoon":
                var compressorSettings = initializer.settings.instruments.woodwinds;
                var filterSettings = initializer.settings.instruments.woodwinds.kind.constraBassoon.filter;
                break;
            case "male":
                var compressorSettings = initializer.settings.instruments.vocals;
                var filterSettings = initializer.settings.instruments.vocals.kind.male.filter;
                break;
            case "female":
                var compressorSettings = initializer.settings.instruments.vocals;
                var filterSettings = initializer.settings.instruments.vocals.kind.female.filter;
                break;
        }
        compressorNode.threshold.value = compressorSettings.compressor.threshold;
        compressorNode.knee.value = compressorSettings.compressor.knee;
        compressorNode.ratio.value = compressorSettings.compressor.ratio;
        compressorNode.reduction.value = compressorSettings.compressor.reduction;
        compressorNode.attack.value = compressorSettings.compressor.attack;
        compressorNode.release.value = compressorSettings.compressor.release;
        actions.setEQPreset(filterSettings);
    }
};



               