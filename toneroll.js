'use strict';
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new this.AudioContext();

/**
 * AudioDevices is a global namespace for audio device classes
 *
 */
var AudioDevices = AudioDevices || {};
AudioDevices.sources = {};
AudioDevices.utilities = {};
AudioDevices.retrievers = {};

/**
 * SystemDevices is a global namespace for system device classes
 *
 */
var SystemDevices = SystemDevices || {};
SystemDevices.adjusters = {};
SystemDevices.processors = {};
SystemDevices.detectors = {};
SystemDevices.calculators = {};
SystemDevices.classifiers = {};
SystemDevices.threads = {};
SystemDevices.workers = {};
SystemDevices.controllers = {};

/**
 * VisualDevices is a global namespace for visual device classes
 *
 */
var VisualDevices = VisualDevices || {};
VisualDevices.initializers = {};
VisualDevices.drawers = {};
VisualDevices.indicators = {};

/**
 * UI is a global namespace for setup the ui properties
 *
 */
var UI = UI || {};
UI.panels = {};
UI.draw = {};
UI.reactions = {};

/**
 * Events is a global namespace for store system events and listeners
 *
 */
var Events = Events || {};
Events.system = {};
Events.user = {};

/**
 * Settings is a global namespace for store system default values
 *
 */
var Settings = Settings || {};
Settings.defaults = {};
Settings.user = {};

/**
 * Workspace() creates a new Workspace
 *
 */
function Workspace() {
    // TODO: instead of pushing window to function we need Workspace to extend window native
    var _this = this;
    _this.compositions = [];
    _this.activeComposition = null;
    // masterVolume transfer the whole composition audio
    _this.masterVolume = new AudioDevices.utilities.simpleGainControler(Settings.defaults.global.masterVolume);
    _this.tempoController = new SystemDevices.controllers.tempoController();
    _this.workflowController = new SystemDevices.controllers.workflowController();
    _this.input = _this.masterVolume.input;
    _this.output = _this.masterVolume.output;
    _this.output.connect(audioContext.destination);

    // variable to controlling active channel from events
    var activeChannel = null;


    // we build one masterRetreiver because if we have performace restrictions 
    // due to the heavy load of this class
    _this.masterRetriever = new SignalRetriever(_this.workflowController);

    // Workspace methods
    /**
     * addComposition() creates a new Composition and push it to the
     * workspace compositions array
     * 
     * @return {int} index
     *
     */
    _this.addComposition = function () {
        _this.compositions.push(new Composition(_this.compositions.length));
        _this.toggleComposition(_this.compositions.length - 1);
        return _this.compositions.length;
    };
    /**
     * toggleComposition() change the active composition
     *
     * @param {int} compositionIndex
     */
    _this.toggleComposition = function (compositionIndex) {
        try {
            _this.compositions[_this.activeComposition].output.disconnect(0);
            _this.compositions[_this.activeComposition].busOutput.disconnect(0);
        } catch (err) {
        }

        // toggle activeComposition index
        _this.activeComposition = compositionIndex;
        // connect the active composition to workspace input (output=input)
        _this.compositions[_this.activeComposition].output.connect(_this.input);
        // connect the active composition bus output to signal retriever
        _this.compositions[_this.activeComposition].bus.output.connect(_this.masterRetriever.input);
    };
    /**
     * getActiveElements() get the active composition and active channel
     *
     */
    _this.getActiveChannel = function () {
        return _this.compositions[_this.activeComposition].activeChannel;
    };

    // local namespace to keep system triggers
    _this.events = {};
    _this.events.selectInstrument = function (value) {
        _this.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets(value);
    };
    _this.events.selectMic = function () {
        _this.masterVolume.device.gain.value = 0;
        _this.compositions[_this.activeComposition].addChannel('userMic');
    };
    _this.events.selectSample = function (e) {
        THEFILE = e.target.files[0];
        _this.compositions[_this.activeComposition].addChannel('userSample');
    };
    _this.events.changePrecision = function (value) {
        Settings.setters.setSystemThreadRate(value);
        _this.masterRetriever.audioTranscriber.thread.rate = 1000 / Settings.getters.getSystemThreadRate();
    };
    _this.events.changeAutocorrect = function (state) {
        _this.masterRetriever.audioTranscriber.thread.autocorrection = state;
    };
    _this.events.changeGain = function (value) {
        _this.masterRetriever.volumeAnalyzer.autoGainControler.maximize(value);
    };
    _this.events.startTranscription = function () {
        if (_this.workflowController.state === 'MIC_READY') {
            var activeChannel = _this.compositions[_this.activeComposition].channels[_this.getActiveChannel()];
            if (Settings.user.ui.volumeMeter) {
                activeChannel.source.volumeMeter.stopDraw();
                activeChannel.source.volumeMeter.drawStatic();
            }
        }
        _this.masterRetriever.audioTranscriber.thread.start();
        _this.masterRetriever.audioRecorder.rec();
        _this.tempoController.metronome.start();

    };
    _this.events.stopTranscription = function () {
        // stop all system proccessing and get the trackSnapshots array
        var trackSnapshots = _this.masterRetriever.audioTranscriber.thread.stop();

        _this.workflowController.setState("LOADING");

        var composePromise = new Promise(function (resolve, reject) {
            // after stop correct and create note objects for all the snapshots
            _this.masterRetriever.audioTranscriber.composer.finalCut(trackSnapshots);

            // the performance time is related to the number of the snapshots
            var loadingTime = trackSnapshots.length / 100;

            if (_this.masterRetriever.audioTranscriber.composer.channelTrack.music.length > 0) {
                resolve();
            } else {
                var loop = setInterval(function () {
                    if (_this.masterRetriever.audioTranscriber.composer.channelTrack.music.length > 0) {
                        resolve(_this.masterRetriever.audioTranscriber.composer.channelTrack.music);
                        clearInterval(loop);
                    }
                }, loadingTime);
            }
        });

        activeChannel = _this.compositions[_this.activeComposition].channels[_this.getActiveChannel()];
//FINDER
        composePromise.then(function (result) {
            // clear canvas and redraw composed notes
            if (_this.workflowController.state !== 'REFRESHED') {
                _this.pianoroll.redrawNotesCorrected(result);

                activeChannel.track.music = _this.masterRetriever.audioTranscriber.composer.channelTrack.music;

                // load samples to buffer
                activeChannel.loadSampler(activeChannel.track.music);

                // promise to give time for loading
                var samplerPromise = new Promise(function (resolve, reject) {
                    if (activeChannel.sampler.checker.checkIfLoaded())
                        resolve();
                    else
                        var loop = setInterval(function () {
                            if (activeChannel.sampler.checker.checkIfLoaded()) {
                                resolve();
                                clearInterval(loop);
                            }
                        }, activeChannel.sampler.checker.interval);
                });
                samplerPromise.then(function () {
                    activeChannel.sampler.isLoaded = activeChannel.sampler.checker.setAsLoaded();

                    // make the rest action for playback after the sampler loaded
                    // load synth
                    activeChannel.loadSynth(activeChannel.track.music);

                    _this.masterVolume.device.gain.value = 1;
                    _this.workflowController.setState("PLAYBACK_READY");
                });
            }
        }, function (err) {
            console.log(err); // Error: "It broke"
        });


        // stop recording and retrieve recorded audio
        _this.masterRetriever.audioRecorder.stop();

        // stop metronome thread
        _this.tempoController.metronome.stop();

        // use of a promise because we need to wait until the buffer copied
        _this.waitForValue = function () {
            return new Promise(function (resolve, reject) {
                if (_this.masterRetriever.audioRecorder.finalRecordedBuffer !== null) {
                    resolve();
                } else {
                    var loop = setInterval(function () {
                        if (_this.masterRetriever.audioRecorder.finalRecordedBuffer !== null) {
                            resolve();
                            clearInterval(loop);
                        }
                    }, 100);
                }
            }).then(function () {
                return _this.masterRetriever.audioRecorder.finalRecordedBuffer;
            }).catch(function (reason) {
                console.log('Handle rejected promise (' + reason + ') here.');
            });
        };

        _this.synchronizer = new SystemDevices.adjusters.synchronizer();
        _this.visualThread = new SystemDevices.threads.visualThread(_this.synchronizer);

        // load recorder audio to buffer
        _this.waitForValue().then(function (result) {
            // use the result here

            activeChannel.track.audio = result;
            activeChannel.loadPlayer(activeChannel.track.audio);
        });

        Settings.states.TRANSCRIBING = false;
    };

    _this.events.startTesting = function () {
        _this.masterRetriever.audioTuner.thread.start();
    };
    _this.events.stopTesting = function () {
        _this.masterRetriever.audioTuner.thread.stop();
    };
    _this.events.originalPlayback = function () {
        activeChannel.player.device.start(0);
        _this.visualThread.startLoop();
        Settings.states.PLAY = true;
        Settings.states.ORIGINALPLAY = true;
    };
    _this.events.synthPlayback = function () {
        activeChannel.synth.start();
        _this.visualThread.startLoop();
        Settings.states.PLAY = true;
        Settings.states.SYNTHPLAY = true;
    };
    _this.events.samplerPlayback = function () {
        activeChannel.sampler.start();
        _this.visualThread.startLoop();
        Settings.states.PLAY = true;
        Settings.states.SAMPLERPLAY = true;
    };

    _this.events.stopPlayback = function () {
        var activeChannel = _this.compositions[_this.activeComposition].channels[_this.getActiveChannel()];
        if (Settings.states.PLAY) {
            if (Settings.states.ORIGINALPLAY) {
                activeChannel.player.device.stop();
                Settings.states.PLAY = false;
                Settings.states.ORIGINALPLAY = false;
            }
            else if (Settings.states.SYNTHPLAY) {
                activeChannel.synth.stop();
                Settings.states.PLAY = false;
                Settings.states.ORIGINALPLAY = false;
            }
            else if (Settings.states.SAMPLERPLAY) {
                activeChannel.sampler.stop();
                Settings.states.PLAY = false;
                Settings.states.SAMPLERPLAY = false;
            }
            _this.visualThread.stopLoop();
            _this.synchronizer = new SystemDevices.adjusters.synchronizer();
            _this.visualThread = new SystemDevices.threads.visualThread(_this.synchronizer);
        }
    };
    _this.events.changeTempo = function (bpm) {
        Settings.setters.setTempo(bpm);
        _this.tempoController.metronome.changeTempo(bpm);
    };

    _this.events.metronomeActivate = function (state) {
        Settings.defaults.global.metronomeActive = state;
        if (state)
            _this.tempoController.metronome.output.connect(audioContext.destination);
        else
            _this.tempoController.metronome.output.disconnect();
    };

    _this.events.tap = function () {
        _this.tempoController.tap.update();
        var bpm = _this.tempoController.tap.getBPM();
        Settings.setters.setTempo(bpm);
    };

    _this.events.autoTempo = function (state) {
        Settings.defaults.global.autoRecognizeTempo = state;
        if (state) {
            document.getElementById("tempo").disabled = true;
            document.getElementById("tap").disabled = true;
        }
        else {
            document.getElementById("tempo").disabled = false;
            document.getElementById("tap").disabled = false;
        }
    };

// create composition
    _this.addComposition();

// initialize listeners
    Events.system.addListeners(_this);

// initialize pianoroll
    _this.pianoroll = new VisualDevices.initializers.pianorollInitializer();
    PIANOROLL = _this.pianoroll.draw();

// initialize UI properties
    UI.initialize(_this);
}

/**
 * Composition() creates a new composition
 * 
 * @param {int} index
 *
 */
function Composition(index) {
    var _this = this;
    _this.index = index;
    _this.tempo = Settings.getters.getTempo();
    _this.channels = [];
    _this.activeChannel = null;
    _this.device = new AudioDevices.utilities.simpleGainControler();
    _this.input = _this.device.input;
    _this.output = _this.device.output;
    _this.bus = new AudioDevices.utilities.simpleGainControler();
    _this.busInput = _this.bus.input;
    _this.busOutput = _this.bus.output;

    // Composition methods
    /**
     * toggleChannel() change the active channel
     *
     * @param {int} channelIndex
     */
    _this.toggleChannel = function (channelIndex) {
        try {
            _this.channels[_this.activeChannel].busOutput.disconnect(0);
        } catch (err) {
        }
        _this.activeChannel = channelIndex;
        _this.channels[_this.activeChannel].isActive = true;
        // connect the active channel bus to composition bus input
        _this.channels[_this.activeChannel].bus.output.connect(_this.bus.input);
    };
    /**
     * addChannel() creates a new channel and push it to the
     * compotition channels array
     * 
     * @param {String} channelType
     * @return {int} index
     *
     */
    _this.addChannel = function (channelType) {
        _this.channels.push(new CompositionChannel(_this.channels.length, _this.index, channelType));
        _this.toggleChannel(_this.channels.length - 1);
        // connect channel to output
        _this.channels[_this.channels.length - 1].output.connect(_this.input);
        return _this.channels.length;
    };
    // not used in demo
//    _this.addChannel(Settings.defaults.channel.channelType);
}

/**
 * CompositionChannel() creates a new composition channel
 *
 * @param {int} index
 * @param {int} compositionIndex
 * @param {String} channelType
 */
function CompositionChannel(index, compositionIndex, channelType) {
    var _this = this;
    ACTIVECHANNEL = _this;
    _this.index = index;
    _this.compositionIndex = compositionIndex;
    _this.title = null;
    // type of channel {userMic,userSample,accompSampler,accompSynth,collab}
    _this.type = channelType;
    _this.isActive = false;
    _this.track = new ChannelTrack();


    // representation of the channel
    _this.pianoroll = PIANOROLL;

    /**
     * createSourceNode() creates the channel device
     *
     * @param {String} channelType
     * @param {object} connectTo is a pointer to the outer device that needs to connect with _this.output - only used in mic source
     * @param (object) buffer - optional (only for systemBuffer)
     * @return {object} _sourceDevice
     */
    _this.createSourceNode = function createSourceNode(channelType, connectTo, inputArray) {
        var sourceDevice = null;
        switch (channelType) {
            case 'userMic':
                sourceDevice = new AudioDevices.sources.mic(connectTo);
                break;
            case 'userSample':
                sourceDevice = new AudioDevices.sources.filePlayer(connectTo);
                break;
            case 'systemBuffer':
                sourceDevice = new AudioDevices.sources.bufferPlayer(inputArray, connectTo);
                break;
            case 'accompSampler':
                sourceDevice = new AudioDevices.sources.sampler();
                break;
            case 'accompSynth':
                sourceDevice = new AudioDevices.sources.synth();
                break;
            case 'systemSampler':
            {
                var notesArray = [];
                for (var i = 0; i < inputArray.length; i++) {
                    if (inputArray[i].note !== 0)
                        notesArray.push(new SamplerNote(inputArray[i].note, inputArray[i].octave, null, inputArray[i].timestamp, inputArray[i].timeDuration));
                }
                sourceDevice = new AudioDevices.sources.sampler("piano", connectTo, notesArray);
                break;
            }
            case 'systemSynth':
                sourceDevice = new AudioDevices.sources.synth(inputArray, connectTo);
                break;
            case 'collab':
                sourceDevice = new AudioDevices.sources.collaborator();
                break;
        }
        return sourceDevice;
    };
    _this.gain = new AudioDevices.utilities.simpleGainControler();
    // bus transfer always audio because we need separate transmiter for the audio that will end up to masterRetriever
    // this is because master retriever is one and aims to retrieve audio from compositionChannels
    _this.bus = new AudioDevices.utilities.simpleGainControler();
    _this.busInput = _this.bus.input;
    _this.busOutput = _this.bus.output;
    // create the source device depend on user/system preferences
    _this.source = _this.createSourceNode(_this.type, _this.gain.input);
    // cannot work here because of the mediaStreamSource success callback - only there we can connect
    // _this.source.output.connect(_this.gain.input);

    _this.loadPlayer = function (buffer) {
        _this.player = _this.createSourceNode('systemBuffer', _this.gain.input, buffer);
    }
    _this.loadSynth = function (notesArray) {
        _this.synth = _this.createSourceNode('systemSynth', _this.gain.input, notesArray);
    }
    _this.loadSampler = function (notesArray) {
        _this.sampler = _this.createSourceNode('systemSampler', _this.gain.input, notesArray);
    }
    _this.gain.output.connect(_this.bus.input);
    // make gain node the output of the channel
    _this.output = _this.gain.output;
}

/**
 * ChannelTrack() creates a new channel track that holds the audio and notation
 * data for the channel
 *
 */
function ChannelTrack() {
    var _this = this;
    _this.audio = [];
    _this.music = [];
}

/**
 * SignalRetriever() creates a new signal retriever
 * for retrieve audio signal from the routing graph
 *
 */
function SignalRetriever(workflowController) {
    var _this = this;

    // create simple gin cotroller and just used as splitter
    _this.simpleGainControler = new AudioDevices.utilities.simpleGainControler();
    _this.input = _this.simpleGainControler.input;

    // create new audio recorder device and connect it
    _this.audioRecorder = new AudioDevices.retrievers.audioRecorder();
    _this.simpleGainControler.output.connect(_this.audioRecorder.input);

    // create new auto gain controler device
//    _this.autoGainControler = new AudioDevices.utilities.autoGainControler();
    _this.volumeAnalyzer = new AudioDevices.utilities.volumeAnalyzer(workflowController);
    _this.simpleGainControler.output.connect(_this.volumeAnalyzer.input);

    // create new audio transcriber device and connect it
    _this.audioTranscriber = new AudioDevices.retrievers.audioTranscriber();
    _this.audioTuner = new AudioDevices.utilities.audioTuner();
    _this.volumeAnalyzer.output.connect(_this.audioTranscriber.input);
    _this.volumeAnalyzer.output.connect(_this.audioTuner.input);
    //MAXIMIZER = _this.autoGainControler;
}

/**
 * mic() is a class with a MediaStreamSource device
 * 
 * @param {device} connectTo is a pointer to the outer device that needs to connect with _this.output
 *
 */
AudioDevices.sources.mic = function (connectTo) {
    var _this = this;
    _this.successCallback = function (e) {
        _this.device = audioContext.createMediaStreamSource(e);
        _this.output = _this.device;
        _this.output.connect(connectTo);

        if (Settings.user.ui.volumeMeter) {
            _this.volumeMeter = new VisualDevices.drawers.volumeDrawer();
            _this.device.connect(_this.volumeMeter.input);
            _this.volumeMeter.drawSignal();
        }
    }
    if (!navigator.getUserMedia) {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia || navigator.msGetUserMedia;
    }
    if (navigator.getUserMedia) {
        navigator.getUserMedia({"audio": {"mandatory": {"googEchoCancellation": "false", "googAutoGainControl": "false", "googNoiseSuppression": "false", "googHighpassFilter": "false"}, "optional": []}}, _this.successCallback, function (e) {
            alert('Error capturing audio. - ' + e);
            console.log(e);
        });
    }
    else {
        alert('getUserMedia not supported in this browser.');
    }
};

/**
 * filePlayer() creates a player device for reproduce audio file buffers
 *
 */
AudioDevices.sources.filePlayer = function (connectTo) {
    var _this = this;
    _this.file = THEFILE;

    _this.bufferFromFile = function (file, callback) {
        var reader = new FileReader();

        reader.onload = function (e) {
            audioContext.decodeAudioData(e.target.result, function (buffer) {
                _this.device = audioContext.createBufferSource();
                _this.device.buffer = buffer;
                _this.device.loop = false;
                _this.output = _this.device;
                _this.output.connect(connectTo);
//                _this.device.start(0);
                callback(buffer);
            });
        };
        reader.onerror = function (evt) {
            switch (evt.target.error.code) {
                case evt.target.error.NOT_FOUND_ERR:
                    alert('File Not Found!');
                    break;
                case evt.target.error.NOT_READABLE_ERR:
                    alert('File is not readable');
                    break;
                case evt.target.error.ABORT_ERR:
                    break; // noop
                default:
                    alert('An error occurred reading this file.');
            }
        }
        reader.readAsArrayBuffer(_this.file);
    };
    _this.bufferFromFile(_this.file, function (buffer) {
    });

};

/**
 * bufferPlayer() creates a player device for reproduce 
 * recorded buffers / channel track audio
 *
 */
AudioDevices.sources.bufferPlayer = function (buffer, connectTo) {
    var _this = this;
    _this.device = audioContext.createBufferSource();
    _this.device.buffer = buffer;
    _this.device.loop = false;
    _this.output = _this.device;
    _this.output.connect(connectTo);
};

//FINDER
/**
 * sampler() creates a sampler device for playback channel tracks
 *
 */
AudioDevices.sources.sampler = function (instrument, outPut, notesArray) {
    var _this = this;

    _this.audioCtx = audioContext;
    _this.instrument = instrument;
    _this.notesArray = notesArray;
    _this.output = outPut;
    _this.masterGain = _this.audioCtx.createGain();
    _this.player = null;
    _this.isLoaded = false;
    _this.mySamples = new SampleLibrary(_this.instrument);
    _this.samplesPath = null;
    _this.loadingTime = 0;
    init();

// init sampler 
    function init() {

        // path intitialization	
        _this.samplesPath = "samples/";

        if (_this.instrument === "piano") {
            _this.samplesPath = _this.samplesPath + "piano";
        }
        _this.samplesPath = _this.samplesPath + "Samples/";

        // output initialization
        if (!outPut) {
            _this.output = audioContext.destination;
        }

        //master gain initialization
        _this.masterGain.connect(_this.output);

        // load samples
        loadSamples();
    }

    function SampleLibrary(instrument) {

        var _this = this;

        var array = [];
        _this.length = 0;
        _this.instrument = instrument;

        _this.push = function (buffer, note, octave) {
            array.push(new Sample(buffer, note, octave));
            _this.length = array.length;
        };

        _this.doesExist = function (note, octave) {

            for (var i = 0; i < array.length; i++) {
                if ((array[i].note === note) && (array[i].octave === octave)) {
                    return array[i].buffer;
                }
            }
            return null;
        };

        _this.doesExistIndex = function (note, octave) {

            for (var i = 0; i < array.length; i++) {
                if ((array[i].note === note) && (array[i].octave === octave)) {
                    return i;
                }
            }
            return null;
        };

        _this.checkIfLoaded = function () {

            if (array.length < 1)
                return false;
            for (var i = 0; i < array.length; i++) {
                if (array[i].buffer === null) {
                    return false;
                }
            }
            return true;
        };

        _this.print = function () {
            console.log("samples lib contains ::::");
            for (var i = 0; i < array.length; i++)
                console.log(i + " " + array[i].note + array[i].octave);
        };

        _this.getSampleByIndex = function (index) {
            return array[index].buffer;
        };


        function Sample(buffer, note, octave) {

            var _this = this;

            _this.buffer = buffer;
            _this.note = note;
            _this.octave = octave;

        }


    }

    function uniques(arr) {
        var flag = true;
        var a = [];
        for (var i = 0; i < arr.length; i++) {
            flag = true;
            for (var j = 0; j < a.length; j++) {
                if ((arr[i].note === a[j].note) && (arr[i].octave === a[j].octave))
                    flag = false;
            }
            if (flag)
                a.push(arr[i]);
        }
        return a;
    }

    function loadSamples() {
        var tmpSample;
        var uniqueSamplesArray = uniques(_this.notesArray);
        for (var i = 0; i < uniqueSamplesArray.length; i++) {
            var currentSamplePath = _this.samplesPath + uniqueSamplesArray[i].note + uniqueSamplesArray[i].octave + ".mp3";
            loadSample(currentSamplePath, uniqueSamplesArray[i]);
        }
    }

    function loadSample(path, note) {
        var request = new XMLHttpRequest();
        request.open("GET", path, true);
        request.responseType = "arraybuffer";
        request.onload = function () {
            _this.audioCtx.decodeAudioData(request.response, function (buffer) {
                _this.mySamples.push(buffer, note.note, note.octave);
            });
        }
        request.send();
    }

    function finilizeSamplesCue() {
        for (var i = 0; i < _this.notesArray.length; i++)
            _this.notesArray[i].SetSampleIndex(_this.mySamples.doesExistIndex(_this.notesArray[i].note, _this.notesArray[i].octave));
    }

    _this.checker = new function () {
        var __this = this;
        __this.retries = 0;
        __this.interval = 50;

        __this.checkIfLoaded = function () {
            tmp = false;
            var tmp = _this.mySamples.checkIfLoaded();
            if (tmp)
                console.log("samples library is loaded");
            return tmp;
        }
        __this.setAsLoaded = function () {
            return true;
        }
    }

    var STtime1;
    _this.start = function () {
        STtime1 = performance.now();
        finilizeSamplesCue();
        _this.isLoaded = _this.checker.setAsLoaded();
        for (var i = 0; i < _this.notesArray.length; i++) {
            playSample(_this.notesArray[i]);
        }
        return true;
    };

    _this.stop = function () {
        _this.masterGain.gain.value = 0;
        _this.player.stop();
    }

    function playSample(note, loadingTime) {

        _this.player = _this.audioCtx.createBufferSource();
        var noteGain = _this.audioCtx.createGain();
        _this.player.connect(noteGain);
        noteGain.gain.value = note.velocity || 1;
        noteGain.connect(_this.masterGain);
        _this.player.buffer = _this.mySamples.getSampleByIndex(note.sampleIndex);
        var flag = false;
        if (note.sampleBuffer)
            flag = true;
        _this.player.start(note.timeStamp + audioContext.currentTime);
        //       noteGain.gain.setTargetAtTime(0, note.timeStamp + (note.duration*5), note.duration*0.7);

    }

    _this.getNotesArray = function () {
        return _this.notesArray;
    };

    _this.setMasterGain = function (val) {
        _this.masterGain.gain.value = val;
    };
};

/**
 * synth() creates a synthesizer device for playback channel tracks
 *
 */
AudioDevices.sources.synth = function (notesArray, connectTo) {
    var _this = this;

    _this.oscillator = audioContext.createOscillator();
    _this.oscillator.type = 'sine';
    _this.gainNode = audioContext.createGain();

    _this.oscillator.connect(_this.gainNode);
    _this.output = _this.gainNode;
    _this.output.connect(connectTo);

    _this.synthArray = [];

    _this.clock = new WAAClock(audioContext);


    _this.synthNote = function (freq, dur, ts, ip) {
        this.frequency = freq;
        this.duration = dur;
        this.timeStamp = ts;
        this.isPause = ip || false;
        var playEvent = _this.clock.setTimeout(function () {
            _this.oscillator.frequency.value = freq;
            _this.gainNode.gain.value = 1;
        }, ts);
        playEvent = _this.clock.setTimeout(function () {
            _this.gainNode.gain.value = 0.00;
        }, ts + dur);
//	_this.clock.timeStretch(audioCtx.currentTime, [playEvent], 0.5);
    };

    _this.start = function () {
        _this.clock.start();
        _this.oscillator.start();
        _this.gainNode.gain.value = 0.0;
        for (var i = 0; i < notesArray.length; i++) {
            _this.synthArray.push(new _this.synthNote(notesArray[i].pitch, notesArray[i].timeDuration, notesArray[i].timestamp));
        }
    }

    _this.stop = function () {
        _this.clock.stop();
        _this.oscillator.stop();
    }

};

/**
 * audioTuner() creates a metronome device with self clock that outputs sound
 * 
 */
AudioDevices.utilities.audioTuner = function () {
    var _this = this;
    _this.pitchDetector = new SystemDevices.detectors.pitchDetector();
    _this.indicator = new VisualDevices.indicators.tunerOutput();
    _this.input = _this.pitchDetector.input;
    _this.pitchDetectorBuffer = _this.pitchDetector.buffer;
    _this.thread = new SystemDevices.threads.tunerThread(_this.pitchDetector, _this.indicator);
}

/**
 * metronome() creates a metronome device with self clock that outputs sound
 * 
 */
AudioDevices.utilities.metronome = function () {
    var _this = this;

    _this.tempo = Settings.getters.getTempo();
    _this.isPlaying = false;      // Are we currently playing?
    _this.startTime;              // The start time of the entire sequence.
    _this.current16thNote;        // What note is currently last scheduled?
    _this.lookahead = 25.0;       // How frequently to call scheduling function 
    //(in milliseconds)
    _this.scheduleAheadTime = 0.1;    // How far ahead to schedule audio (sec)
    // This is calculated from lookahead, and overlaps 
    // with next interval (in case the timer is late)
    _this.nextNoteTime = 0.0;     // when the next note is due.
    _this.noteResolution = 2;     // 0 == 16th, 1 == 8th, 2 == quarter note
    _this.noteLength = 0.05;      // length of "beep" (in seconds)
    _this.last16thNoteDrawn = -1; // the last "box" we drew on the screen
    _this.notesInQueue = [];      // the notes that have been put into the web audio,
    // and may or may not have played yet. {note, time}
    _this.timerWorker = null;     // The Web Worker used to fire timer messages
    _this.device = audioContext.createOscillator();
    _this.gain = new AudioDevices.utilities.simpleGainControler();
    _this.gain.value = 0.9;
    _this.output = _this.gain.output;
    if (Settings.defaults.global.metronomeActive)
        _this.output.connect(audioContext.destination);

    _this.changeTempo = function (tempo) {
        _this.tempo = tempo;
    }

    _this.nextNote = function () {
        // Advance current note and time by a 16th note...
        var secondsPerBeat = 60.0 / Settings.getters.getTempo();    // Notice this picks up the CURRENT 
        // tempo value to calculate beat length.
        _this.nextNoteTime += 0.25 * secondsPerBeat;    // Add beat length to last beat time

        _this.current16thNote++;    // Advance the beat number, wrap to zero
        if (_this.current16thNote == 16) {
            _this.current16thNote = 0;
        }
    };

    _this.scheduleNote = function (beatNumber, time) {
        // push the note on the queue, even if we're not playing.
        _this.notesInQueue.push({note: beatNumber, time: time});

        if ((_this.noteResolution == 1) && (beatNumber % 2))
            return; // we're not playing non-8th 16th notes
        if ((_this.noteResolution == 2) && (beatNumber % 4))
            return; // we're not playing non-quarter 8th notes

        _this.device = audioContext.createOscillator();
        _this.device.connect(_this.gain.input);

        if (beatNumber % 16 === 0)    // beat 0 == high pitch
            _this.device.frequency.value = 880.0;
        else if (beatNumber % 4 === 0)    // quarter notes = medium pitch
            _this.device.frequency.value = 440.0;
        else                        // other 16th notes = low pitch
            _this.device.frequency.value = 220.0;


        _this.device.start(time);
        Settings.defaults.global.beatTimestamp = time;
        _this.device.stop(time + _this.noteLength);
    };

    _this.scheduler = function () {
        // while there are notes that will need to play before the next interval, 
        // schedule them and advance the pointer.
        while (_this.nextNoteTime < audioContext.currentTime + _this.scheduleAheadTime) {
            _this.scheduleNote(_this.current16thNote, _this.nextNoteTime);
            _this.nextNote();
        }
    };

    _this.start = function () {
        _this.current16thNote = 0;
        _this.nextNoteTime = audioContext.currentTime;
        _this.timerWorker.postMessage("start");
    };

    _this.stop = function () {
        _this.timerWorker.postMessage("stop");
    };
    _this.init = function () {
        _this.timerWorker = new Worker("metronome.js");
        _this.timerWorker.onmessage = function (e) {
            if (e.data == "tick") {
                _this.scheduler();
            }
        };
        _this.timerWorker.postMessage({"interval": _this.lookahead});
    };

    _this.init();

};

/**
 * simpleGainControler() creates a simple volume device - most used as the channel
 * device replacing a splitter device
 * 
 * @param {String} gainValue
 */
AudioDevices.utilities.simpleGainControler = function (gainValue) {
    var _this = this;
    _this.device = audioContext.createGain();
    _this.device.gain.value = gainValue || 1;
    _this.input = _this.device;
    _this.output = _this.input;
    // TODO: system creates a gain node
};

/**
 * autoGainControler() creates the auto gain controler device
 *
 */
AudioDevices.utilities.autoGainControler = function (workflowController) {
    var _this = this;

    _this.preGainNode = audioContext.createGain();
    _this.limiterNode = audioContext.createDynamicsCompressor();
    _this.limiterNode.threshold.value = 0.0; // this is the pitfall, leave some headroom
    _this.limiterNode.knee.value = 0.0; // brute force
    _this.limiterNode.ratio.value = 20.0; // max compression
    _this.limiterNode.attack.value = 0.005; // 5ms attack
    _this.limiterNode.release.value = 0.050; // 50ms release
    _this.input = _this.preGainNode;
    _this.output = _this.limiterNode;
    _this.input.connect(_this.output);
    _this.currentMaximize = null;
    _this.dbToGain = function (db) {
        return Math.exp(db * Math.log(10.0) / 20.0);
    };
    _this.maximize = function (db) {
        _this.preGainNode.gain.value = _this.dbToGain(db);
        _this.currentMaximize = db;
    };
    // default maximize the signal
    _this.maximize(Settings.defaults.global.maximize);

    function controller() {
        var __this = this;
        __this.topCounter = 0;
        __this.bottomCounter = 0;
        __this.prevTopdb = null;
        __this.prevBottomdb = null;
        __this.sumBottomdb = 0;
        __this.averageBottomdb = 0;
        __this.volumeStabilized = false;
        __this.peakDetected = false;

        // check volume level to either volume down or show low level message
        __this.peakDetect = function (db) {
            if (db > -5) {
                __this.peakDetected = true;
            }
            checkTop(db);
            if (!__this.volumeStabilized || !__this.peakDetected)
                checkBottom(db);

            // detect if 5 values in row are higher than 0 db
            function checkTop(db) {
                if (db > 0 && __this.prevTopdb > 0) {
                    if (__this.topCounter === 5) {
                        var newValue = _this.currentMaximize - 1;
                        _this.maximize(newValue);
                        __this.volumeStabilized = true;
                        __this.prevTopdb = null;
                        __this.topCounter = 0;
                        return 1;
                    }
                    else {
                        __this.topCounter++;
                        __this.prevTopdb = db;
                    }
                } else if (db > 0) {
                    __this.prevTopdb = db;
                }
            }
            function checkBottom(db) {
                if (db < -25 && __this.prevBottomdb < -25) {
                    __this.sumBottomdb += db;
                    __this.bottomCounter++;

                    if (__this.bottomCounter === 1000) {
                        __this.averageBottomdb = __this.sumBottomdb / __this.bottomCounter;
                        if (__this.averageBottomdb < -25) {

                            // TODO in a clever way - problem is the noise level
//                            var newValue = _this.currentMaximize + 1;
//                            _this.maximize(newValue);

                            // alert user for low volume level
                            if (Settings.states.TRANSCRIBING)
                                workflowController.printUserMessage("LOW_LEVEL");

                            __this.sumBottomdb = 0;
                            __this.bottomCounter = 0;
                            return -1;
                        } else {
                            __this.sumBottomdb = 0;
                            __this.bottomCounter = 0;
                        }
                    }
                } else if (db < -25) {
                    __this.prevBottomdb = db;
                }
            }
        }
    }
    _this.controller = new controller();
};

/**
 * volumeAnalyzer() creates a volume meter
 *
 */
AudioDevices.utilities.volumeAnalyzer = function (workflowController) {
    var _this = this;

    _this.audioCtx = audioContext;
    _this.autoGainControler = new AudioDevices.utilities.autoGainControler(workflowController);
    _this.analyzer = _this.audioCtx.createScriptProcessor(1024, 1, 1);
    _this.canvas = document.getElementById("volume").getElementsByClassName("meter")[0];
    _this.input = _this.autoGainControler.input;
    _this.autoGainControler.output.connect(_this.analyzer);
    _this.output = _this.autoGainControler.output;

    // the script processor bug
    _this.proccessOutGain = _this.audioCtx.createGain();
    _this.analyzer.connect(_this.proccessOutGain);
    _this.proccessOutGain.gain.value = 0;
    _this.proccessOutGain.connect(_this.audioCtx.destination);

    var ctx = _this.canvas.getContext('2d');
    var w = _this.canvas.width;
    var h = _this.canvas.height;

    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, w, h);

    _this.autoGainControler.output.connect(_this.analyzer);
    _this.analyzer.connect(_this.audioCtx.destination);

    _this.analyzer.onaudioprocess = function (e) {
        var out = e.outputBuffer.getChannelData(0);
        var int = e.inputBuffer.getChannelData(0);
        var max = 0;

        for (var i = 0; i < int.length; i++) {
            out[i] = 0;//prevent feedback and we only need the input data
            max = int[i] > max ? int[i] : max;
        }
        // convert from magnitude to decibel
        var db = 20 * Math.log(Math.max(max, Math.pow(10, -72 / 20))) / Math.LN10;
        db = Math.round(db);

        // get current db and controll maximize
//        if(autoGainControl)
        _this.autoGainControler.controller.peakDetect(db);

        var grad = ctx.createLinearGradient(w / 10, h * 0.07, w / 10, h);
        grad.addColorStop(0, 'red');
        grad.addColorStop(0.01, 'DarkOrange');
        grad.addColorStop(0.3, 'yellow');
        grad.addColorStop(0.5, 'GreenYellow');
        grad.addColorStop(1, 'green');
        ctx.fillStyle = '#555';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = grad;
        ctx.fillRect(w / 10, h * (db / -60), w * 8 / 10, (h * 0.95) - h * 0.8 * (db / -72));
        ctx.fillStyle = "white";
        ctx.font = "Arial 12pt";
        ctx.textAlign = "center";
        ctx.fillText(Math.round(db * 100) / 100 + ' dB', w / 2, h - h * 0.025);
    };

    _this.gainUpdate = function (value) {
        _this.autoGainControler.maximize(value);
    };
};

/**
 * dynamicCompressor() creates a basic dynamic compressor device
 *
 */
AudioDevices.utilities.dynamicCompressor = function () {
    var _this = this;
    _this.device = audioContext.createDynamicsCompressor();
    _this.input = _this.device;
    _this.output = _this.input;
    _this.setPreset = function (preset) {
        _this.device.threshold.value = preset.threshold;
        _this.device.knee.value = preset.knee;
        _this.device.ratio.value = preset.ratio;
        _this.device.reduction.value = preset.reduction;
        _this.device.attack.value = preset.attack;
        _this.device.release.value = preset.release;
    }
};

/**
 * equalizer() creates an equalizer device.
 * 
 * Definition of a ParametricEQ object
 * consist of 8 biquadFilter nodes.
 * An 8-band parametric EQ type for convenient application of filters
 *
 */
AudioDevices.utilities.equalizer = function () {
    var _this = this;
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
    _this.setPreset = function (preset) {
        if (preset.freqs)
            _this.setBandFrequencies(preset.freqs);
        if (preset.types)
            _this.setBandTypes(preset.types);
        if (preset.Qs)
            _this.setQValues(preset.Qs);
        if (preset.gains)
            _this.setBandGains(preset.gains);
    };
};

/**
 * audioRecorder() creates the audio recorder device
 *
 */
AudioDevices.retrievers.audioRecorder = function () {
    var _this = this;
    _this.finalRecordedBuffer = null;
    _this.bufferLen = Settings.defaults.global.recorderBufferLength;
    _this.recorderCore = audioContext.createScriptProcessor(_this.bufferLen, 2, 2);

    /**       vazw ena boolean isRecording pou 8a to xreiastw gia eswterikes diadikasies kai na elegxw
     *        pote krataw ta input buffers . 
     */
    _this.isRecording = false;
    _this.recorderCore.onaudioprocess = function (e) {
        if (_this.isRecording) {
            _this.recorderWorker.postMessage({
                cmd: 'rec',
                buffer: [e.inputBuffer.getChannelData(0), e.inputBuffer.getChannelData(1)]
            });
        }
    };

    /**     pairnei to finalRecordedBuffer kai to metatrepei se audio buffer
     *      
     *      @return {AudioBuffer} finalAudioBuffer
     */
//    _this.returnRecordedAudioBuffer = function (finalRecordedBuffer) {
//        var finalAudioBuffer = audioContext.createBuffer(2, finalRecordedBuffer[0].length, audioContext.sampleRate);
//        finalAudioBuffer.getChannelData(0).set(finalRecordedBuffer[0]);
//        finalAudioBuffer.getChannelData(0).set(finalRecordedBuffer[1]);
//        return finalAudioBuffer;
//    };

    _this.recorderWorker = new Worker('recorder.js');
    _this.recorderWorker.onmessage = function (e) {
        if (e.data) {
            var returnedBuffer = e.data;
            _this.finalRecordedBuffer = audioContext.createBuffer(2, returnedBuffer[0].length, audioContext.sampleRate);
            _this.finalRecordedBuffer.getChannelData(0).set(returnedBuffer[0]);
            _this.finalRecordedBuffer.getChannelData(1).set(returnedBuffer[1]);
        }
    };

    // arxikopoihsh tou recorder_Worker , stelnei command init kai to sample rate     
    _this.initRecorder = function () {
        _this.recorderWorker.postMessage({
            cmd: 'init',
            sampleRate: audioContext.sampleRate
        });
    };

    _this.rec = function () {
        _this.isRecording = true;
    };
    _this.stop = function () {
        _this.isRecording = false;
        _this.recorderWorker.postMessage({
            cmd: 'editBuffers'
        });
    };

    // initialize recorder
    _this.initRecorder();

    _this.input = _this.recorderCore;
    _this.output = _this.input;

    // must connect with destination for scriptprocessor to play
    _this.output.connect(audioContext.destination);
};

/**
 * audioTranscriber() construct the audio transctiber
 * for retrieve audio signal from the routing graph
 *
 */
AudioDevices.retrievers.audioTranscriber = function () {
    var _this = this;
    _this.gain = new AudioDevices.utilities.simpleGainControler(1.3);
    _this.input = _this.gain.input;
    _this.pitchDetector = new SystemDevices.detectors.pitchDetector();
    _this.onsetDetector = new SystemDevices.detectors.eventDetector();
    _this.beatTracker = new SystemDevices.calculators.beatTracker();
    _this.synchronizer = new SystemDevices.adjusters.synchronizer();
    _this.corrector = new SystemDevices.adjusters.corrector();
    _this.composer = new SystemDevices.adjusters.composer();
    _this.pitchDetectorBuffer = _this.pitchDetector.buffer;
    _this.onsetDetectorBuffer = _this.onsetDetector.buffer;
    _this.input.connect(_this.pitchDetector.input);
    _this.input.connect(_this.onsetDetector.input);
    _this.thread = new SystemDevices.threads.systemThread(_this.pitchDetector, _this.onsetDetector, _this.beatTracker, _this.synchronizer, _this.corrector, _this.composer);
    _this.startTranscription = function () {
        _this.thread.start();
    };
    _this.output = _this.input;
};

/**
 * systemThread() executed x times per second and trigger system methods
 * 
 * @param {object} pitchDetector is a system device
 * @param {object} onsetDetector is a system device
 * @param {object} beatTracker is a system device
 * @param {object} synchronizer is a system device
 * @param {object} corrector is a system device
 * @param {object} composer is a system device
 *
 */
SystemDevices.threads.systemThread = function (pitchDetector, onsetDetector, beatTracker, synchronizer, corrector, composer) {
    var _this = this;
    _this.rate = 1000 / Settings.getters.getSystemThreadRate();
    _this.autocorrection = false;
    _this.trackSnapshots = [];
    _this.composedTrack = [];
    _this.visualThread = new SystemDevices.threads.visualThread(synchronizer);

    // setInterval workflow variables
    var fpsInterval, startTime, now, then, elapsed;

    _this.thread = function (trackSnapshots) {
        var __this = this;

        __this.currentTimestamp = null;
        __this.xCanvasPosition = 0;
        __this.currentCycle = 0;
        __this.pitch = null;
        __this.isOnset = null;
        __this.snapshotAmp = null;
        __this.sampleRate = null;
        __this.tempo = beatTracker.tempo;
        __this.currentSnapshot = null;
        __this.snapshotsNeedForCorrrection = 1;
        __this.tempBeatCounter = null;
        __this.threadWorkflow = function () {
            // set system starting time
            synchronizer.countSystemDelay.startingTime = performance.now();

            // demo is one minute
//            if (__this.currentTimestamp >= 60) {
//                TONEROLLDEMO.workflowController.setState('DEMO_ENDED');
//                TONEROLLDEMO.events.stopTranscription();
//                $("#startTranscription").fadeOut(500, function () {
//                    $("#startPlayback").fadeIn();
//                });
//            }

            // set timestamp for current cycle NOW
            __this.currentTimestamp = synchronizer.setGlobalTime();

            if (Settings.user.ui.metronomeFlash) {
                // trigger an event in on every metronome beat
                if (Settings.defaults.global.beatTimestamp !== __this.tempBeatCounter) {
                    _this.visualThread.overlayDrawer.changeColorOpacity();
                    __this.tempBeatCounter = Settings.defaults.global.beatTimestamp;
                }
            }

            __this.xCanvasPosition = _this.visualThread.xCanvasPosition;

            // cycle counter - we substract 1 because the cycle wont to start from 0
            __this.currentCycle = synchronizer.setSystemCycles() - 1;

            __this.pitch = pitchDetector.updatePitch();
            __this.isOnset = onsetDetector.updateOnsets(__this.currentCycle, __this.pitch);

            // get the processed signal amp - DEPRECATED
            __this.snapshotAmp = onsetDetector.workflow.normalized;

            // calculate sample rate per second
            __this.sampleRate = synchronizer.countOutputSampleRate();
            if (__this.isOnset)
                console.log('ONSET');
            if (Settings.defaults.global.autoRecognizeTempo) {
                if (__this.isOnset) {
                    console.log('ONSET');
                    // calculate tempo - if current cycle is offset push cycle number for calculation
                    __this.tempo = beatTracker.calculateBPM(__this.currentCycle, __this.sampleRate);

                    // pass tempo to the visual thread
                    Settings.setters.setTempo(__this.tempo);
                }
            }

            __this.currentSnapshot = SystemDevices.processors.snapshotCreator(__this.pitch, __this.isOnset, __this.tempo, __this.currentTimestamp, __this.xCanvasPosition, __this.currentCycle, __this.snapshotAmp); // TODO : updateOnets() must return current cycle boolean for onsets

            trackSnapshots.push(__this.currentSnapshot);

            // actions to do if autocorrection (AKA preprocessing) is enabled
            if (_this.autocorrection) {
                trackSnapshots = corrector.processSnapshots(trackSnapshots);
                // draw snapshots - change _this.visualThread.drawableSnapshot which is the virtual thread's variable - also we produce technical delay, for the system to be able to correct before render
                __this.snapshotsNeedForCorrrection = 8;
            }
            else {
                __this.snapshotsNeedForCorrrection = 1;
            }

            // set system proccess end time
            synchronizer.countSystemDelay.proccessEndTime = performance.now();

            if (trackSnapshots[trackSnapshots.length - __this.snapshotsNeedForCorrrection] instanceof NoteSnapshot)
                _this.visualThread.snapshotBuffer.pushSnapshot(trackSnapshots[trackSnapshots.length - __this.snapshotsNeedForCorrrection]);

            _this.trackSnapshots = trackSnapshots;

            // composedTrack is the array with notes for the composition channel
            _this.composedTrack = composer.channelTrack.music;
        }

        __this.loop = setInterval(function () {
            // throttle requestAnimationFrame to a specific frame rate
            now = audioContext.currentTime * 1000;
            elapsed = now - then;
            // if enough time has elapsed, draw the next frame
            if (elapsed > fpsInterval) {
                // Get ready for next frame by setting then=now, but also adjust for your
                // specified fpsInterval not being a multiple of RAF's interval
                then = now - (elapsed % fpsInterval);
                __this.threadWorkflow();
            }
        }, _this.rate);
    };
    _this.start = function () {
        fpsInterval = _this.rate;
        then = audioContext.currentTime * 1000;
        startTime = then;
        synchronizer.setStartingTime();
        // start sample playback if it is sample
        if (ACTIVECHANNEL.type === "userSample")
            ACTIVECHANNEL.source.device.start(0);

        // start threads
        _this.thread = new _this.thread(_this.trackSnapshots);
        _this.visualThread.startLoop();

//        set the global state to transcribing
        Settings.states.TRANSCRIBING = true;
    };
    _this.stop = function () {
        // stop sample playback if it is sample
        if (ACTIVECHANNEL.type === "userSample") {
            ACTIVECHANNEL.source.device.stop(0);
        }
        // disconnect microphone from output
        else if (ACTIVECHANNEL.type === "userMic") {
            ACTIVECHANNEL.source.device.disconnect();
        }
        // stop threads
        clearInterval(_this.thread.loop);
        _this.visualThread.stopLoop();
        Settings.states.TRANSCRIBING = false;
//        synchronizer.clock.stop();
        return _this.trackSnapshots;
    };
};


/**
 * visualThread() executed x times per second and trigger visual methods
 *
 */
SystemDevices.threads.visualThread = function (synchronizer) {
    var _this = this;
    _this.rate = (1000 / Settings.getters.getVisualThreadRate());
//    _this.drawableSnapshot = null;

    _this.tempo = Settings.getters.getTempo();
    _this.cursorMove = false;
    _this.xCanvasPosition = 0;
    _this.snapshotBuffer = new SystemDevices.processors.snapshotBuffer();
    _this.pianorollDrawer = new VisualDevices.drawers.pianorollDrawer();
    _this.momentaryOutput = new VisualDevices.indicators.momentaryOutput();
    _this.overlayDrawer = new VisualDevices.drawers.overlayDrawer();

    // request animation frame workflow variables
    var requestId = 0;
    var fpsInterval, startTime, now, then, elapsed;
    // shim layer with setTimeout fallback
    window.requestAnimFrame = (function () {
        return  window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame;
    })();
    window.cancelAnimFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
    _this.animLoop = function () {
        requestId = requestAnimFrame(_this.animLoop);
        // throttle requestAnimationFrame to a specific frame rate
        now = audioContext.currentTime * 1000;
        elapsed = now - then;
        // if enough time has elapsed, draw the next frame
        if (elapsed > fpsInterval) {
            // Get ready for next frame by setting then=now, but also adjust for your
            // specified fpsInterval not being a multiple of RAF's interval
            then = now - (elapsed % fpsInterval);

            _this.tempo = Settings.getters.getTempo();

            synchronizer.countSystemDelay.drawStartTime = _this.pianorollDrawer.renderSnapshots(_this.snapshotBuffer.readBuffer(), synchronizer.pspc, _this.cursorMove);

            // visualize audio input background
//                try {
//                    _this.signalDrawer.renderSignal(_this.xCanvasPosition, SIMPLEANALYSER.getInput());
//                } catch (err) {
//                }
            // indicate snapshot details
            if (Settings.user.ui.indicateOutput) {
                _this.momentaryOutput.indicate(_this.snapshotBuffer.buffer[_this.snapshotBuffer.buffer.length - 1], _this.tempo);
            }

            // move the time cursor
            try {
                _this.overlayDrawer.moveCursor(_this.xCanvasPosition);
            } catch (err) {
            }

            // follow draw
            if (Settings.user.ui.autoFollow) {
                UI.draw.followDraw(_this.xCanvasPosition);
            }

            synchronizer.setSpeed(_this.tempo);
            synchronizer.countSystemDelay.calculateOffset();

            // TODO: mix the following together in synscronizer device
            // value to allow cursor to move based on synchronization - this will affect next cycle
            _this.cursorMove = synchronizer.speedLimiter();
            _this.xCanvasPosition = synchronizer.xCanvasPosition;
            _this.xCanvasPosition = synchronizer.synchPos(_this.xCanvasPosition, synchronizer.pspc);
        }
    };
    _this.startLoop = function () {
        fpsInterval = _this.rate;
        then = audioContext.currentTime * 1000;
        startTime = then;
        _this.animLoop();
    };
    _this.stopLoop = function () {
        // clear cursor when loop stops (when transcription stops)
        _this.overlayDrawer.clearCursor();
        cancelAnimFrame(requestId);
        requestId = 0;
    };
};

/**
 * tunerThread() executed x times per second and trigger tuning methods
 * 
 */
SystemDevices.threads.tunerThread = function (pitchDetector, indicator) {
    var _this = this;
    _this.rate = 1000 / 30;
    _this.noteFromPitch = function (frequency) {
        var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        return Math.round(noteNum) + 57; // for 8 octaves
    };
    _this.centsOffFromPitch = function (frequency, note) {
        return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
        function frequencyFromNoteNumber(note) {
            return 440 * Math.pow(2, (note - 57) / 12); // for 8 octaves
        }
    };
    _this.thread = function () {
        var __this = this;
        __this.pitch = null;
        __this.note = null;
        __this.detune = null;
        __this.octave = null;
        __this.loop = setInterval(function () {
            __this.pitch = pitchDetector.updatePitch();
            __this.detune = _this.centsOffFromPitch(__this.pitch, _this.noteFromPitch(__this.pitch));
            try {
                __this.note = Settings.static.noteStrings[_this.noteFromPitch(__this.pitch) % 96].match(/[A-G+#]/gi).join('');
            } catch (err) {
            }
            try {
                __this.octave = Settings.static.noteStrings[_this.noteFromPitch(__this.pitch) % 96].match(/[0-9]+/g).map(function (n)
                {//just coerce to numbers
                    return +(n);
                })[0];
            } catch (err) {
            }

            indicator.indicate(__this.pitch, __this.note, __this.octave, __this.detune);
        }, _this.rate);
    };
    _this.start = function () {
        _this.thread = new _this.thread();
//        set the global state to TESTING
        Settings.states.TESTING = true;
    };
    _this.stop = function () {
        // stop threads
        clearInterval(_this.thread.loop);
        Settings.states.TESTING = false;
    };
};

/**
 * preseter() adjust the right preset for each system function based
 * on the kind of instrument
 * 
 * @param {object} compressor is an audio routing graph device
 * @param {object} equalizer is an audio routing graph device
 *
 */
SystemDevices.adjusters.preseter = function (compressor, equalizer) {
    var _this = this;
    _this.compressor = compressor;
    _this.equalizer = equalizer;
    _this.applyInstrumentPresets = function (instrument) {
        var presets = Settings.defaults.instrumentPresets;
        var compressorSettings = null;
        var filterSettings = null;
        switch (instrument) {
            case "piano":
                compressorSettings = presets.piano.compressor;
                filterSettings = presets.piano.kind.standard88Key.filter;
                break;
            case "guitar":
                compressorSettings = presets.strings.compressor;
                filterSettings = presets.strings.kind.guitar.filter;
                break;
            case "violin":
                compressorSettings = presets.strings.compressor;
                filterSettings = presets.strings.kind.violin.filter;
                break;
            case "viola":
                compressorSettings = presets.strings.compressor;
                filterSettings = presets.strings.kind.viola.filter;
                break;
            case "cello":
                compressorSettings = presets.strings.compressor;
                filterSettings = presets.strings.kind.cello.filter;
                break;
            case "bass":
                compressorSettings = presets.strings.compressor;
                filterSettings = presets.strings.kind.bass.filter;
                break;
            case "harp":
                compressorSettings = presets.strings.compressor;
                filterSettings = presets.strings.kind.harp.filter;
                break;
            case "trumpet":
                compressorSettings = presets.brass.compressor;
                filterSettings = presets.brass.kind.trumpet.filter;
                break;
            case "tenorTrombone":
                compressorSettings = presets.brass.compressor;
                filterSettings = presets.brass.kind.tenorTrombone.filter;
                break;
            case "bassTrombone":
                compressorSettings = presets.brass.compressor;
                filterSettings = presets.brass.kind.violin.filter;
                break;
            case "frenchHorn":
                compressorSettings = presets.brass.compressor;
                filterSettings = presets.brass.kind.frenchHorn.filter;
                break;
            case "tuba":
                compressorSettings = presets.brass.compressor;
                filterSettings = presets.brass.kind.tuba.filter;
                break;
            case "piccolo":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.piccolo.filter;
                break;
            case "flute":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.flute.filter;
                break;
            case "oboe":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.oboe.filter;
                break;
            case "clarinet":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.clarinet.filter;
                break;
            case "altoSax":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.altoSax.filter;
                break;
            case "tenorSax":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.tenorSax.filter;
                break;
            case "bassoon":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.bassoon.filter;
                break;
            case "constraBassoon":
                compressorSettings = presets.woodwinds.compressor;
                filterSettings = presets.woodwinds.kind.constraBassoon.filter;
                break;
            case "male":
                compressorSettings = presets.vocals.compressor;
                filterSettings = presets.vocals.kind.male.filter;
                break;
            case "female":
                compressorSettings = presets.vocals.compressor;
                filterSettings = presets.vocals.kind.female.filter;
                break;
        }
        // initialize compressor
        compressor.setPreset(compressorSettings);
        equalizer.setPreset(filterSettings);
    };
};

/**
 * corrector() correct snapshots based on the
 * track array - currently characterize snapshots with onsets and offsets
 *
 */
SystemDevices.adjusters.corrector = function () {
    var _this = this;
    _this.snapshots = [];
    _this.processSnapshots = function (snaps) {
        var editableSnapshot = snaps[snaps.length - 3];

//             Correction of the postprevious Note
        try {
            if (editableSnapshot instanceof NoteSnapshot) {
                var correctPitch = _this.correctPitch(editableSnapshot.pointer + 3, snaps);
                snaps = correctPitch.snapshots;
                editableSnapshot.correctNote(correctPitch.dominantPitch);
            }
        } catch (err) {
        }
        return snaps;
    };
    _this.correctPitch = function (arrayPosition, snapshots) {
        try {
            var snapshots = snapshots;
            var lowDiff = 300; // low frequencies differrence in Hz
            var highDiff = 0; // high frequencies differrence in Hz
            var lowThreshold = 100; // lowest threshold in Hz to compare - many times the errors are below this threhold
            var highThreshold = 0; // higest threshold in Hz to compare - many times the errors are above this threhold
            var thisObject = snapshots[arrayPosition - 3];
            var prevObject = snapshots[arrayPosition - 4];
            var prev2Object = snapshots[arrayPosition - 5];
            var nextObject = snapshots[arrayPosition - 2];
            var next2Object = snapshots[arrayPosition - 1];

            var result = [];
            // conditions to evaluate the pitch depending on the sumOutput array (other pitches and silences)
            var errCons = {
                lowthres: thisObject.pitch < lowThreshold,
                highthres: thisObject.pitch > highThreshold,
                prevpitchdiff: prevObject.pitch > thisObject.pitch + lowDiff,
                nextpitchdiff: nextObject.pitch > thisObject.pitch + lowDiff,
                prevcomp: thisObject.pitch !== prevObject.pitch,
                prev2comp: thisObject.pitch !== prev2Object.pitch,
                nextcomp: thisObject.pitch !== nextObject.pitch,
                next2comp: thisObject.pitch !== next2Object.pitch,
                prevandnextequal: prevObject.pitch === prev2Object.pitch === nextObject.pitch === next2Object.pitch,
                issilencebefore: previousAreSilence(arrayPosition - 3),
                hasspaceinnote: (prevObject instanceof SilenceSnapshot) && !(previousAreSilence(arrayPosition - 3)),
                // this can be true only for exact numbers not even a cent up/down
                isharmonic: (thisObject.pitch % nextObject.pitch) === 0,
                iserror: (thisObject instanceof ErrorSnapshot),
                prevnote: (prevObject instanceof NoteSnapshot)
            };
            result[1] = errCons.issilencebefore && errCons.nextcomp && errCons.next2comp;
            result[2] = errCons.nextpitchdiff;
            result[3] = errCons.hasspaceinnote;
            result[4] = errCons.prevandnextequal && errCons.prevcomp;
            result[5] = errCons.prevcomp && errCons.nextcomp && errCons.prevpitchdiff;
            result[6] = errCons.lowthres && errCons.nextcomp && errCons.prevcomp;
            result[7] = errCons.isharmonic && errCons.nextcomp;
            result[8] = errCons.iserror && errCons.prevnote && !(errCons.issilencebefore);
            if (result.contains(true)) {
                if (result[3]) {
                    snapshots[arrayPosition - 4].pitch = thisObject.pitch;
                    snapshots[arrayPosition - 4].xCanvasPosition = thisObject.xCanvasPosition - 1;
                    snapshots[arrayPosition - 4].pointer = thisObject.pointer - 1;
                    snapshots[arrayPosition - 4].isOnset = false;
                    snapshots[arrayPosition - 4].timestamp = null;
                } else if (result[8]) {
                    snapshots[thisObject.pointer] = snapshots[arrayPosition - 4];
                    snapshots[thisObject.pointer].xCanvasPosition = thisObject.xCanvasPosition - 1;
                    snapshots[thisObject.pointer].pointer = thisObject.pointer - 1;
                    snapshots[thisObject.pointer].isOnset = false;
                    snapshots[thisObject.pointer].timestamp = null;
                }
                else {
                    return {dominantPitch: nextObject.pitch, snapshots: snapshots};
                }
            } else {
                return {dominantPitch: thisObject.pitch, snapshots: snapshots}; // the pitch is equal to the next n and prev n so we return it untouched
            }
        } catch (err) {
        }
        function previousAreSilence(arrayPosition) {                         // function to scan previous objects and see if all of a specified (random at the moment) are silence - used in correctPitches conditions
            var i = 4;
            var isSilence;
            for (i = 4; i < 60; i++) {
                if ((snapshots[arrayPosition - i] instanceof SilenceSnapshot)) { //check if i is silence
                    isSilence = true;
                } else {
                    isSilence = false;
                    break;
                }
            }
            return isSilence;
        }
    };
};

/**
 * composer() compose the composition by mixing each snapshot
 * information with classifier patterns information
 *
 */
SystemDevices.adjusters.composer = function () {
    var _this = this;
    _this.channelTrack = new ChannelTrack();


    _this.processorWorker = new Worker('processor.js');
    _this.processorWorker.onmessage = function (event) {
        _this.createNotesFromGroups(JSON.parse(event.data));
    };
    _this.processorWorker.onerror = function (event) {
        throw event;
    };

    _this.finalCut = function (snapshots) {

        var snapshotsGroups = createSnapshotsGroups(snapshots);

        _this.processorWorker.postMessage({groups: JSON.stringify(snapshotsGroups), snapshots: JSON.stringify(snapshots), minRow: Settings.defaults.global.noteMinSnapshots.dynamic});

        function createSnapshotsGroups(snapshots) {
            snapshots.push(new SilenceSnapshot(snapshots.length - 1).pointer);

            var snasphotsGroups = [];
            var tempNote = null;
            var groupStarted = false;
            var silenceStarted = false;

            // the minimum number of same note snapshots in row to make group - relative value to thread rate
//            var minRow = parseInt(Settings.getters.getSystemThreadRate() / 20);
// FINDER
            var minRow = Settings.defaults.global.noteMinSnapshots.dynamic;
            //console.log(Settings.defaults.global.noteMinSnapshots.dynamic);
            var count = 0;
            var minus = 0;

            // process the snapshots array
            for (var i = 0; i < snapshots.length; ++i) {

//
                // check if current snapshot is notesnapshot and no group has started
                if (snapshots[i] instanceof NoteSnapshot && !groupStarted) {
                    silenceStarted = false;
//                    console.log("logika ta minRow prota snapshots -> snapshots[i] instanceof NoteSnapshot && !groupStarted ------ check if current snapshot is notesnapshot and no group has started");
                    // check if we have a group - more than n same notes in row
                    if ((snapshots[i].note === tempNote && minRow === count) || snapshots[i].isOnset) {
                        minus = i - count;

                        // create new group
                        snasphotsGroups.push(new snapshotsGroup(snapshots[minus]));

                        // add current to group
//                        var lastSnapPointer = snasphotsGroups[snasphotsGroups.length - 1].snapshots[snasphotsGroups[snasphotsGroups.length - 1].snapshots.length - 1].pointer
//                        if (lastSnapPointer < snapshots[minus].pointer)
//                            snasphotsGroups[snasphotsGroups.length - 1].addSnapshot(snapshots[minus]);
//                            console.log(snapshots[minus].pointer);

                        tempNote = null;

                        groupStarted = true;

                        minRow = Settings.defaults.global.noteMinSnapshots.dynamic;

                    } else if (snapshots[i].note === tempNote && minRow > count) {
                        count++;
                    } else {
                        tempNote = snapshots[i].note;
                    }

                    // check if current snapshot is notesnapshot and a group has started
                } else if (snapshots[i] instanceof NoteSnapshot && groupStarted) {
//                    console.log("kathe nota META apo ena ONSET -> snapshots[i] instanceof NoteSnapshot && groupStarted ------- check if current snapshot is notesnapshot and a group has started");
                    var snapshotCounted = count;
                    count = 0;

                    if (snapshots[i - snapshotCounted].note === snasphotsGroups[snasphotsGroups.length - 1].note && !snapshots[i - snapshotCounted].isOnset) {
//                        console.log('--just fill with notes');
                        snasphotsGroups[snasphotsGroups.length - 1].addSnapshot(snapshots[i - snapshotCounted]);
                    }
                    // cut same note if a new onset has arrived
                    else if (snapshots[i - snapshotCounted].note === snasphotsGroups[snasphotsGroups.length - 1].note && snapshots[i - snapshotCounted].isOnset) { // && snasphotsGroups[snasphotsGroups.length - 1].snapshots.length > 2  ?
//                        console.log('--cut same note if a new onset has arrived');
                        snapshots[i - snapshotCounted - 1] = new SilenceSnapshot(snapshots[i - snapshotCounted - 1].pointer);
                        groupStarted = false;
                    }
                    else {
                        groupStarted = false;
                    }
                    // check if there are two silences at row
                } else if (snapshots[i] instanceof SilenceSnapshot) {
                    silenceStarted = true;
                    if (silenceStarted) {
                        groupStarted = false;
                    }
                }
            }
            return snasphotsGroups;
        }
        function snapshotsGroup(noteStart) {
            var _this = this;
            _this.snapshots = [];
            _this.note = noteStart.note;
            _this.tempOnset = noteStart;
            _this.tempOffset = null;

            _this.addSnapshot = function (snapshot) {
                _this.snapshots.push(snapshot);
                _this.tempOffset = _this.snapshots[_this.snapshots.length - 1];
            }
            _this.addSnapshot(noteStart);
            _this.setOffset = function () {
                _this.tempOffset = _this.snapshots[_this.snapshots.length - 1];
            };
        }
    }

    _this.createNotes = function (onsetPointer, OffsetPointer, snapshots) {
        //create the whole single note from the snapshots
        var note = new SingleNote(onsetPointer, OffsetPointer, snapshots);
        //console.log(note);
        _this.channelTrack.music.push(note);
        return _this.channelTrack;
    };
    _this.addNote = function (note) {
        _this.channelTrack.music.push(note);
        return _this.channelTrack;
    };
    _this.createNotesFromGroups = function (groups) {
        for (var i = 0; i < groups.length; i++) {
//            if (groups[i].snapshots.length >= Settings.defaults.global.noteMinSnapshots.dynamic)
            _this.createNotes(groups[i].tempOnset.pointer, groups[i].tempOffset.pointer, groups[i].snapshots);
        }
    };
};

/**
 * synchronizer() adjust the time and space relevance
 *
 */
SystemDevices.adjusters.synchronizer = function () {
    var _this = this;

    _this.zeroTimestamp = null;
    _this.globalTimestamp = null;
    _this.systemCycles = 0;

    // beats per minute
    _this.bpm = Settings.getters.getTempo();

    // beats per second
    _this.bps = _this.bpm / 60;

    // pixel speed per second - for example in 120 bpm it moves 1 pixel every 25ms
    _this.psps = _this.bps * Settings.defaults.global.beatWidth();

    // pixel speed per cycle
    _this.pspc = _this.psps / Settings.getters.getVisualThreadRate();

    // milliseconds pass per pixel 
    _this.msppp = 1 / (_this.psps / 1000);

    // dynamic millisecond difference
    _this.dynamicMsDiff = _this.msppp / 1000;

    // this is to disallow change pixel faster than MSPPP - take value from speedLimiter()
    _this.stepForward = false;

    // current position on canvas - metered in pixels on x axis
    _this.xCanvasPosition = 0;

    _this.setStartingTime = function () {
        _this.zeroTimestamp = audioContext.currentTime;
        return _this.zeroTimestamp;
    };
    _this.setGlobalTime = function () {
        _this.globalTimestamp = audioContext.currentTime - _this.zeroTimestamp;
        return _this.globalTimestamp;
    };
    _this.setSystemCycles = function () {
        _this.systemCycles++;
        return _this.systemCycles;
    };
    _this.setSpeed = function (tempo) {
        _this.bpm = tempo;
        _this.bps = _this.bpm / 60;
        _this.psps = _this.bps * Settings.defaults.global.beatWidth();
        _this.pspc = _this.psps / Settings.getters.getVisualThreadRate();
        _this.msppp = 1 / (_this.psps / 1000);
        _this.dynamicMsDiff = _this.msppp / 1000;
    };

    // variables to count the system delay/time offset in result
    _this.countSystemDelay = {
        startingTime: null,
        proccessEndTime: null,
        drawStartTime: null,
        overallOffsetMs: null,
        offsetSecs: null,
        offsetPixels: null,
        calculateOffset: function () {
            this.overallOffsetMs = this.drawStartTime - this.startingTime;
            this.offsetSecs = this.overallOffsetMs / 1000;
            _this.psps = _this.psps - (_this.psps * this.offsetSecs);
        }
    };

    // TODO DEBUG
    // delay maybe from the mic in or the web audio api or the browser
    var unknownOffsetDelay = null;

    _this.speedLimiter = function () {
//        var clockLoop = _this.clock.setTimeout(function () {
//            _this.xCanvasPosition++;
//            _this.stepForward = true;
//        }, (_this.msppp / 1000))
//        return _this.stepForward;
        if ((audioContext.currentTime - _this.zeroTimestamp) >= _this.dynamicMsDiff) {
            _this.dynamicMsDiff = _this.dynamicMsDiff + _this.msppp / 1000;
            if (_this.xCanvasPosition < 10)
                unknownOffsetDelay = 0;
            _this.xCanvasPosition = (_this.xCanvasPosition + _this.pspc - unknownOffsetDelay);
            _this.stepForward = true;
        } else {
            _this.stepForward = false;
        }
        return _this.stepForward;

    };

    _this.sampleRate = null;
    _this.startProccessingTimestamp = _this.zeroTimestamp;
    _this.tmpFinalOutputSamplesLength = null;
    /**
     * countOutputSampleRate() measure the real frequency per second of the thread
     * which is equal to the system output sample rate
     *
     * @return {int} sampleRate measured in Hz
     * 
     */
    _this.countOutputSampleRate = function () {
        // condition to run each second
        if (_this.globalTimestamp - _this.startProccessingTimestamp >= 1) {
            _this.startProccessingTimestamp = _this.globalTimestamp;
            _this.sampleRate = _this.systemCycles - _this.tmpFinalOutputSamplesLength;
            _this.tmpFinalOutputSamplesLength = _this.systemCycles;
            // TODO: here we can count the most common finalOutputSampleRate each time (in compare with the previous ones) and use this
        }
        return _this.sampleRate;
    };
// FINDER
    /**
     * calculateMinResults() is a calculation to find minNoteValue -> Hz /(bpm/60sec) * minNoteValue
     * if the result is over noteMinSnapshots then minNoteValue is true
     *
     * @return {int} minNoteValue - 2=1/8 4=1/16 8=1/32
     * @return {int} remainSnaps snapshots to add on Settings.defaults.global.noteMinSnapshots when composing
     */
    _this.calculateMinResults = function (rate, bpm) {
        var minNoteFound = false;
        var counter = 1;
        while (!minNoteFound) {
            if (counter === 1) {
                Settings.defaults.global.minNoteValue.dynamic = Settings.defaults.global.minNoteValue.static;
                Settings.defaults.global.noteMinSnapshots.dynamic = Settings.defaults.global.noteMinSnapshots.static;
            }
            var remainSnaps = rate / ((bpm / 60) * Settings.defaults.global.minNoteValue.dynamic) - Settings.defaults.global.noteMinSnapshots.dynamic + 10;
            if (remainSnaps >= 0) {
                minNoteFound = true;
                Settings.defaults.global.noteMinSnapshots.dynamic = parseInt((Settings.defaults.global.noteMinSnapshots.dynamic + remainSnaps - 10));
                return {minNoteValue: Settings.defaults.global.minNoteValue.dynamic, remainSnaps: Settings.defaults.global.noteMinSnapshots.dynamic};
            } else {
                Settings.defaults.global.minNoteValue.dynamic = Settings.defaults.global.minNoteValue.static / (counter * 2);
                minNoteFound = false;
            }
            counter++;
        }
    }
    _this.calculateMinResults(Settings.defaults.global.systemThreadRate, Settings.defaults.global.tempo);

    _this.prevSnapshotPos = null;
    _this.tmpXCanvasPosition = null;
    _this.counter = 1;
    /**
     * synchPos() is a way to synchronize the xPos between the two asynchronous threads
     *
     */
    _this.synchPos = function (snapshotPos, pspcVisual) {
        if (_this.prevSnapshotPos !== null) {
            // find the relation of rates between the two dynamic rate threads
            var threadRateRelation = Settings.getters.getSystemThreadRate() / Settings.getters.getVisualThreadRate();

            // pspc calculates based on visual trhead rate, we will translate it to system thread rate
            var pspcSystem = pspcVisual / threadRateRelation;

            if (snapshotPos === _this.prevSnapshotPos || snapshotPos === _this.tmpXCanvasPosition) {
                if (_this.counter === 1)
                    _this.tmpXCanvasPosition = snapshotPos;
                snapshotPos = _this.tmpXCanvasPosition + (pspcSystem * _this.counter);
                _this.counter++;
            } else {
                _this.tmpXCanvasPosition = null;
                _this.counter = 1;
            }
        }
        _this.prevSnapshotPos = snapshotPos;
        return snapshotPos;
    }
};

/**
 * snapshotCreator() create Snapshots
 *
 * @param {float} pitch is the bestCorrelation for current cycle
 * @param {boolean} isOnset indicates if current snapshot is onset
 * @param {float} tempo is the current cycle bpm
 * @param {float} currentTimestamp is the current cycle timestamp from beginning
 * @param {int} xCanvasPosition is the current x poxition on canvas
 * @param {int} currentCycle is the current thread cycle
 * @param {float} snapshotAmp is the current cycle signal amplitude
 * 
 */
SystemDevices.processors.snapshotCreator = function (pitch, isOnset, tempo, currentTimestamp, xCanvasPosition, currentCycle, snapshotAmp) {
    var snapshot = processPitch(pitch);
    function processPitch(pitch) {
        if (pitch === -1) { //if (ac === -1 || noteEnded) {
            // create silence object instance
            return new SilenceSnapshot(currentCycle, currentTimestamp, xCanvasPosition, snapshotAmp);
        } else if (pitch === 11025 || pitch === 12000) {

            // create error object instance
            return new ErrorSnapshot(currentCycle, currentTimestamp, xCanvasPosition, snapshotAmp);
        } else {
            // create note object instance
            return new NoteSnapshot(pitch, isOnset, tempo, currentCycle, currentTimestamp, xCanvasPosition, snapshotAmp);
        }
    }
//    console.log(snapshot.pointer + " " + snapshot.constructor.name + " " + snapshot.amp + " " + snapshot.isOnset + " " + snapshot.note + " " + " " + snapshot.pitch);
    return snapshot;
};

/**
 * snapshotBuffer() is system device for buffering the asynchronous system thread with visual thread snapshots
 *
 */
SystemDevices.processors.snapshotBuffer = function () {
    var _this = this;

    _this.preBuffer = [];
    _this.buffer = [];
    _this.bufferCounter = 0;
    _this.threadRateRelation = 1;

    _this.pushSnapshot = function (snapshot) {
        // find the relation of rates between the two dynamic rate threads
        _this.threadRateRelation = Settings.getters.getSystemThreadRate() / Settings.getters.getVisualThreadRate();

        if (_this.bufferCounter < _this.threadRateRelation) {
            _this.preBuffer.push(snapshot);
            _this.bufferCounter++;
        } else if (_this.bufferCounter === _this.threadRateRelation) {
            _this.bufferCounter = 0;
            _this.preBuffer.push(snapshot);
        }
    }
    _this.readBuffer = function () {
        _this.buffer = _this.preBuffer;
        _this.preBuffer = [];
        return _this.buffer;
    }

};

/**
 * normalizer() create a real time normalizer
 *
 * @param {array} unNormalized is the raw input array
 * @param {array} normalized is the normalized array
 * @param {float} maxNormValue is the max value between unnormalized frames
 * @param {String} type is the type of function requested normalization
 * 
 */
SystemDevices.processors.normalizer = function (unNormalized, normalized, maxNormValue, type, startNormalize, pitch) {
    var _this = this;
    _this.unNormalized = unNormalized;
    _this.type = type;
    _this.settings = {};
    // get preset settings per type of function
    switch (_this.type) {
        case 'onsetDetectedFrame':
            _this.settings = Settings.defaults.normalizer.onsetDetectedFrame;
            break;
        case 'updatePitch':
            _this.settings = Settings.defaults.normalizer.updatePitch;
            break;
        case 'updateOnsets':
            _this.settings = Settings.defaults.normalizer.updateOnsets;
            break;
        case 'simpleAnalyser':
            _this.settings = Settings.defaults.normalizer.simpleAnalyser;
            break;
    }

    // assign values from preset settings
    _this.factor = _this.settings.factor || 1;
    _this.isInteger = _this.settings.isInteger || false;
    _this.frameSize = _this.settings.frameSize || Settings.defaults.global.normalizeFrameSize;
    _this.noisegate = _this.settings.noiseGate || 0;
    _this.startNormalize = startNormalize || true;
    _this.pitch = pitch || -1;

    // detectframe normalization
    if (_this.type === 'onsetDetectedFrame') {
        var values = [];
        for (var i = _this.unNormalized.length - _this.frameSize; i < _this.unNormalized.length - 1; i++) {
            values.push(_this.unNormalized[i]);
        }
        _this.unNormalized = values;
    } else {
        _this.frameCounter = 0;
        var arrayPos = 0;
        // cut input into frames after a certain size to avoid process the whole signal continuesly
        if (_this.unNormalized.length > _this.frameSize * 2) {
            _this.unNormalized = _this.unNormalized.slice(_this.unNormalized.length - _this.frameSize, _this.unNormalized.length);
            _this.frameCounter++;
        }
        arrayPos = _this.frameCounter * _this.frameSize;
    }

    // the basic normalization task
    var maxValue = _this.unNormalized.reduce(function (max, item) {
        return Math.max(Math.abs(max), Math.abs(item));
    });
    var m = Math.max(Math.abs(maxValue));
    // use the biggest number it finds on previous frames if its bigger than current max
    if (m < maxNormValue) {
        m = maxNormValue;
    }

    if (_this.type === 'onsetDetectedFrame') {
        normalized = _this.factor / m * _this.unNormalized[_this.unNormalized.length - 1] || 0;
    } else {
        for (var j = 0; j < _this.unNormalized.length; j++) {
            // noise gate - 
            if ((_this.type !== 'updatePitch') && (Math.abs(_this.unNormalized[j]) > _this.noisegate) || (_this.type === 'updatePitch' && Math.abs(_this.unNormalized[j]) > _this.noisegate)) {
                normalized[j + arrayPos] = _this.factor / m * _this.unNormalized[j];
            } else {
                normalized[j + arrayPos] = 0;
            }
            if (_this.type === 'updateOnsets' && _this.startNormalize) {
                normalized[j + arrayPos] = _this.factor / m * _this.unNormalized[j];
            } else {
                normalized[j + arrayPos] = _this.unNormalized[j];
            }
            if (_this.type === 'updateOnsets' && _this.pitch === -1) {
                normalized[j + arrayPos] = 0;
            }
            if (_this.isInteger) {
                normalized[j + arrayPos] = Math.round(normalized[j + arrayPos]);
            }
        }
    }
    return {unNormalized: _this.unNormalized, normalized: normalized, maxNormValue: m};
};

/**
 * pitchDetector() detect pitch/pitches for each snapshot
 *
 */
SystemDevices.detectors.pitchDetector = function () {
    var _this = this;
    _this.compressor = new AudioDevices.utilities.dynamicCompressor();
    _this.equalizer = new AudioDevices.utilities.equalizer();
    _this.preseter = new SystemDevices.adjusters.preseter(_this.compressor, _this.equalizer);
    // initilalize utility devices with initial preset
    _this.preseter.applyInstrumentPresets(Settings.defaults.global.defaultInstrument);
    _this.pitchAnalyserNode = audioContext.createAnalyser();
    _this.pitchAnalyserNode.fftSize = Settings.defaults.global.pitchDetectorFFTSize;
    _this.pitchAnalyserNode.smoothingTimeConstant = 1;
    // * pitchAnalyserTempBuf = new Uint8Array(pitchAnalyserBuflen);
    _this.buffer = new Uint8Array(_this.pitchAnalyserNode.fftSize);
    _this.audioInput = {unNormalized: [], normalized: [], maxNormValue: 0};
    // connect internal devices
    _this.input = _this.compressor.input;
    _this.input.connect(_this.equalizer.input);
    _this.equalizer.output.connect(_this.pitchAnalyserNode);
    // create an autocorrelation web worker
    _this.updatePitchWorker = new Worker('updatePitch.js');
    var bestCorrelation = null;
    _this.updatePitchWorker.onmessage = function (event) {
        bestCorrelation = event.data;
    };
    _this.updatePitchWorker.onerror = function (event) {
        throw event;
    };
    /**
     * updatePitch() the main pitch detect function
     * 
     * @return {float} bestCorrelation is the best match frequency returned by the autocorrelation algorithm
     *
     */
    _this.updatePitch = function () {
        var buffer = _this.buffer;
        _this.pitchAnalyserNode.getByteTimeDomainData(buffer);
        // normalize the audio input frame
        _this.audioInput.unNormalized = buffer;
        var processedSignal = SystemDevices.processors.normalizer(_this.audioInput.unNormalized, _this.audioInput.normalized, _this.audioInput.maxNormValue, 'updatePitch');
        _this.audioInput.normalized = processedSignal.normalized;
        _this.audioInput.maxNormValue = processedSignal.maxNormValue;
        try {
            _this.updatePitchWorker.postMessage({array: _this.audioInput.normalized, samples: audioContext.sampleRate});
        } catch (err) {
        }
        return bestCorrelation;
    };
};

/**
 * eventDetector() detect events (onsets, offsets) on snapshots
 *
 */
SystemDevices.detectors.eventDetector = function () {
    var _this = this;
    _this.onsetCompressorNode = audioContext.createDynamicsCompressor();
    _this.onsetCompressorNode.threshold.value = -20;
    _this.onsetCompressorNode.knee.value = 6;
    _this.onsetCompressorNode.ratio.value = 6;
    _this.onsetCompressorNode.reduction.value = 10;
    _this.onsetCompressorNode.attack.value = 40;
    _this.onsetCompressorNode.release.value = 70;
    _this.onsetAnalyserNode = audioContext.createAnalyser();
    _this.onsetAnalyserNode.fftSize = Settings.defaults.global.onsetDetectorFFTSize;
    _this.buffer = new Float32Array(_this.onsetAnalyserNode.fftSize);
    _this.audioInput = {unNormalized: [], normalized: [], maxNormValue: 0};
    _this.workflow = {unNormalized: [], normalized: [], maxNormValue: 0};
    _this.startNormalize = {condition: false};
    _this.onsets = [];
    _this.currentCycleIsOnset = false;
    _this.processedSignal = [];
    _this.input = _this.onsetCompressorNode;
    _this.input.connect(_this.onsetAnalyserNode);
    // create two onsetDetection web workers
    _this.updateOnsetDetectWorker = new Worker('updateOnsetDetect.js');
    _this.updateOnsetPickWorker = new Worker('updateOnsetPick.js');
    _this.updateOnsetDetectWorker.onmessage = function (event) {

        // normalize the audio input frame
        _this.workflow.unNormalized = event.data;
        var processedSignal = SystemDevices.processors.normalizer(_this.workflow.unNormalized, _this.workflow.normalized, _this.workflow.maxNormValue, 'onsetDetectedFrame');
        _this.workflow.normalized = processedSignal.normalized;
        _this.workflow.maxNormValue = processedSignal.maxNormValue;
        try {
            _this.updateOnsetPickWorker.postMessage(_this.workflow.normalized);
        } catch (err) {
        }
    };
    _this.updateOnsetPickWorker.onmessage = function (event) {
        // assign returned values to object's variables
        _this.currentCycleIsOnset = event.data;
    };
    _this.updateOnsetDetectWorker.onerror = function (event) {
        throw event;
    };
    _this.updateOnsetPickWorker.onerror = function (event) {
        throw event;
    };
    /**
     * updateOnsets() the main onset detect function
     * 
     * @return {boolean} currentCycleIsOnset is aboolean indicates if the current thread cycle is an onset
     *
     */
    _this.updateOnsets = function (currentCycle, pitch) {
        var buffer = _this.buffer;
        _this.onsetAnalyserNode.getFloatTimeDomainData(buffer);
        // normalize the audio input frame
        _this.audioInput.unNormalized = buffer;
        if (pitch !== 11025 && pitch !== 1200) {
            _this.startNormalize.condition = true;
        }
        var processedSignal = SystemDevices.processors.normalizer(_this.audioInput.unNormalized, _this.audioInput.normalized, _this.audioInput.maxNormValue, 'updateOnsets', _this.startNormalize.condition, pitch);
        _this.audioInput.normalized = processedSignal.normalized;
        _this.audioInput.maxNormValue = processedSignal.maxNormValue;
        try {
            _this.updateOnsetDetectWorker.postMessage({frameSize: Settings.defaults.global.onsetDetectorFrameSize, framesOverlap: Settings.defaults.global.onsetDetectorFrameOverlap, array: _this.audioInput.normalized, samples: audioContext.sampleRate});
        } catch (err) {
        }

        // fill up an onset array locally just in case
        if (_this.currentCycleIsOnset)
            _this.onsets.push(currentCycle);
        return _this.currentCycleIsOnset;
    };
};

/**
 * beatTracker() calculate tempo - DEPRECATED for demo
 *
 */
SystemDevices.calculators.beatTracker = function () {
    var _this = this;
    _this.tempo = Settings.getters.getTempo();
    _this.onsets = [];
    _this.intervals = null;
    _this.bpmTop = [];
    _this.cycleTempos = [];
    _this.systemThreadRate = 1000 / Settings.getters.getSystemThreadRate();
    _this.dominantTempo = Settings.getters.getTempo();
    _this.calculateBPM = function (onsetCycle, sampleRate) {
        _this.onsets.push(onsetCycle);
        _this.intervals = _this.CountIntervalsBetweenNearbyPeaks(_this.onsets);
        var groups = _this.GroupNeighborsByTempo(_this.intervals, sampleRate);
        _this.bpmTop = groups.sort(function (intA, intB) {
            return intB.count - intA.count;
        }).splice(0, 5);
        _this.bpmCondition = _this.dominantTempo !== '-Infinity' && !isNaN(_this.bpmTop[0].tempo);
        // summarize the tempos from each cycle in an array and then find the most common
        try {
            if (_this.cycleTempos.length < 1) {
                if (_this.bpmCondition) {
                    _this.cycleTempos.push((_this.bpmTop[0].tempo));
                    return parseInt(_this.bpmTop[0].tempo.toFixed(1));
                } else
                    return Settings.getters.getTempo();
            } else {
                if (_this.bpmCondition) {
                    _this.cycleTempos.push((_this.bpmTop[0].tempo));
                    _this.dominantTempo = Math.max.apply(Math, _this.cycleTempos);
                    _this.tempo = _this.dominantTempo;

                    // set the global state of bpm recognized
                    Settings.states.BPM_RECOGNIZED = true;

                    return parseInt(_this.dominantTempo.toFixed(1));
                } else
                    return parseInt(_this.dominantTempo.toFixed(1));
            }
        } catch (err) {
        }

    };
    // Function used to return a histogram of peak intervals
    _this.CountIntervalsBetweenNearbyPeaks = function (peaks) {
        var intervalCounts = [];
        peaks.forEach(function (peak, index) {
            for (var i = 0; i < 10; i++) {
                var interval = peaks[index + i] - peak;
                var foundInterval = intervalCounts.some(function (intervalCount) {
                    if (intervalCount.interval === interval)
                        return intervalCount.count++;
                });
//                 console.log("interval");
//                console.log(foundInterval);
                if (!foundInterval) {
                    intervalCounts.push({
                        interval: interval,
                        count: 1
                    });
                }
            }
//            console.log("----------------------");
        });
        return intervalCounts;
    };
    // Function used to return a histogram of tempo candidates.
    _this.GroupNeighborsByTempo = function (intervalCounts, sampleRate) {
        var tempoCounts = [];
        intervalCounts.forEach(function (intervalCount) {
            if (intervalCount.interval !== 0) {
                // TODO : replaced by countOutputSampleRate - need FIX - wrong results
                if (_this.systemThreadRate > 0)
                    var theoreticalTempo = 60 / (intervalCount.interval / (sampleRate || Settings.getters.getSystemThreadRate()));
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
    };
};

/**
 * tempoController() is a class for holding the tempo related objects
 *
 */
SystemDevices.controllers.tempoController = function () {
    var _this = this;
    _this.metronome = new AudioDevices.utilities.metronome();
    _this.tap = new SystemDevices.calculators.tap();
}

/**
 * workflowController() for set states on the system's workflow and showing user messages
 *
 */
SystemDevices.controllers.workflowController = function () {
    var _this = this;
    _this.state = null;

    _this.setState = function (state) {
        if (state === 'DEMO_ENDED') {
            $('#demo-ended-modal').modal('show');
            _this.state = 'DEMO_ENDED';
        } else if (state === 'REFRESHED') {
            _this.state = 'REFRESHED';
        } else if (_this.state !== 'DEMO_ENDED' && _this.state !== 'REFRESHED') {
            _this.state = state;
            _this.printUserMessage(state);
        }
    }

    var messageQueue = [{text: null, class: null}];
    messageQueue.shift();

    _this.printUserMessage = function (state) {
        var message = null;
        var classType = null;
        switch (state) {
            case "MIC_READY":
            {
                message = Settings.messages.MIC_READY;
                classType = 'alert-success';
                break;
            }
            case "SAMPLE_READY":
            {
                message = Settings.messages.SAMPLE_READY;
                classType = 'alert-success';
                break;
            }
            case "NOT_READY":
            {
                message = Settings.messages.NOT_READY;
                classType = 'alert-warning';
                break;
            }
            case "LOADING":
            {
                message = Settings.messages.LOADING;
                classType = 'alert-warning';
                break;
            }
            case "PLAYBACK_READY":
            {
                message = Settings.messages.PLAYBACK_READY;
                classType = 'alert-success';
                break;
            }
            case "RECOGNIZING_BPM":
            {
                message = Settings.messages.RECOGNIZING_BPM;
                classType = 'alert-info';
                break;
            }
            case "BPM_RECOGNIZED":
            {
                message = Settings.messages.BPM_RECOGNIZED;
                classType = 'alert-success';
                break;
            }
            case "REFRESHED":
            {
                message = Settings.messages.REFRESHED;
                classType = 'alert-success';
                break;
            }
            case "LOW_LEVEL":
            {
                message = Settings.messages.LOW_LEVEL;
                classType = 'alert-danger';
                break;
            }
        }
//        // show the message
        messageQueue.push({text: message, class: classType});

        function hideMessage() {
            messageQueue.shift();
            $("#messages").fadeOut(500, function () {
                $("#messages").hide();
                $("#messages .message-container").removeClass();
                $("#messages > div").addClass("message-container");
                $("#messages .message-container").html("");
            });
        }
        function showMessage() {
            try {
                $("#messages .message-container").html(messageQueue[0].text);
                $("#messages .message-container").addClass(messageQueue[0].class);
            } catch (err) {
            }
            $("#messages").fadeIn(500, function () {
                if (classType !== 'alert-info')
                    setTimeout(function () {
                        hideMessage();
                    }, 2500);
            });
        }

        if (messageQueue.length > 1) {
            hideMessage();
            setTimeout(function () {
                showMessage();
            }, 800);
        } else {
            showMessage();
        }

    }
}

/**
 * tap() calculate the bpm from the user tapping
 *
 */
SystemDevices.calculators.tap = function () {
    var _this = this;
    _this.audioCtx = audioContext;
    // final BPM that is counted at getBPM()
    _this.finalBPM = null;
    // current time got from audioCtx.currentTime() when tap is clicked
    _this.currentTime = null;
    // the time of the previous click
    _this.previousTime = null;
    // an array used for averageBPM
    _this.array = [];
    // average BPM
    _this.averageBPM = null;

    // When tap is clicked , computes current BPM and pushes the value to array .
    // if its called for the first tap (so previous time is still zero) it returns
    // , previous time gets the current time value , BPM is not computed yet .
    // If the user decide to change BPM (so the new BPM is greater or smaller than old BPM*3)
    // tap array is being reset for better average results .
    _this.update = function () {
        _this.currentTime = _this.audioCtx.currentTime;
        if (!_this.previousTime) {
            _this.previousTime = _this.currentTime;
            return;
        }
        var tmp = 60 / (_this.currentTime - _this.previousTime);
        _this.previousTime = _this.currentTime;
        if (tmp > (3 * _this.array[_this.array.length - 1])) {
            _this.reset();
            return;
        }
        if (tmp < (_this.array[_this.array.length - 1] / 3)) {
            _this.reset();
            return;
        }
        _this.array.push(tmp);
    };
    // returns final BPM that is computed : <last tap's BPM> * 0.5 + <average BPM> * 0.5
    _this.getBPM = function () {
        var tmpSum = 0;
        var currentBPM = 0;
        for (var i = 0; i < _this.array.length; i++) {
            tmpSum += _this.array[i];
        }
        currentBPM = _this.array[i - 1];
        _this.averageBPM = (tmpSum / (i));
        _this.finalBPM = ((_this.averageBPM * 0.8) + (currentBPM * 0.2)) || Settings.defaults.global.tempo;
        if (!isNaN(_this.finalBPM))
            _this.finalBPM = _this.finalBPM.toFixed(1);
        return _this.finalBPM;
    };
    // resets array and average BPM
    _this.reset = function () {
        _this.array = [];
        _this.averageBPM = 0;
    }
    // returns Array (debug function)
    _this.getArray = function () {
        return _this.array;
    }
};

/**
 * pianorollInitializer() draw the composition pianoroll
 *
 */
VisualDevices.initializers.pianorollInitializer = function () {
    var _this = this;
    // pianoroll canvas
    _this.pianorollCanvas = document.getElementsByClassName("pianorollCanvas")[0];
    _this.pianorollContext = _this.pianorollCanvas.getContext('2d');
    _this.pianorollCanvas.width = Settings.defaults.global.canvasWidth;
    _this.pianorollCanvas.height = 1000;
    // notes Overlay canvas
    _this.notesOverlayCanvas = document.getElementsByClassName("notesOverlayCanvas")[0];
    _this.notesOverlayContext = _this.notesOverlayCanvas.getContext('2d');
    _this.notesOverlayCanvas.width = Settings.defaults.global.canvasWidth;
    _this.notesOverlayCanvas.height = 1000;
    // notes canvas
    _this.notesCanvas = document.getElementsByClassName("notesCanvas")[0];
    _this.notesContext = _this.notesCanvas.getContext('2d');
    _this.notesCanvas.width = 40;
    _this.notesCanvas.height = 1000;
    // notes canvas
    _this.barsCanvas = document.getElementsByClassName("barsCanvas")[0];
    _this.barsContext = _this.barsCanvas.getContext('2d');
    _this.barsCanvas.width = Settings.defaults.global.canvasWidth;
    _this.barsCanvas.height = 20;
    // time canvas
    _this.timeCanvas = document.getElementsByClassName("timeCanvas")[0];
    _this.timeContext = _this.timeCanvas.getContext('2d');
    _this.timeCanvas.width = Settings.defaults.global.canvasWidth;
    _this.timeCanvas.height = 20;

    _this.drawer = new VisualDevices.drawers.pianorollDrawer();
    _this.tempo = Settings.getters.getTempo();
    _this.beatWidth = Settings.defaults.global.beatWidth();
    _this.barWidth = _this.beatWidth * 4;
    _this.secWidth = _this.tempo / 60 * _this.beatWidth;
    // draw notes on pianoroll
    _this.drawPianoRollNotes = function () {
        _this.notesContext.fillStyle = "#a29292";
        _this.notesContext.font = "10px Arial";
        var pianoRollNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        var position = 980;
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 12; j++) {
                _this.notesContext.fillText(pianoRollNotes[j] + i, 0, position);
                position -= 10;
            }
        }
        for (var k = 20; k < 990; k = k + 10) {
            _this.notesContext.lineWidth = 0.5;
            _this.notesContext.strokeStyle = '#efefef';
            _this.notesContext.beginPath();
            _this.notesContext.moveTo(0, k);
            _this.notesContext.lineTo(_this.notesCanvas.width, k);
            _this.notesContext.stroke();
            // draw note lines on canvas
            _this.pianorollContext.lineWidth = 0.5;
            _this.pianorollContext.strokeStyle = '#efefef';
            _this.pianorollContext.beginPath();
            _this.pianorollContext.moveTo(0, k);
            _this.pianorollContext.lineTo(_this.pianorollCanvas.width, k);
            _this.pianorollContext.stroke();
        }
    };
    // draw bars on pianoroll
    _this.drawPianoRollBars = function () {
        _this.barsContext.fillStyle = "#a29292";
        _this.barsContext.font = "10px Arial";
        _this.pianorollContext.lineWidth = 1;
        _this.pianorollContext.strokeStyle = '#D5D5D5';
        var initialMargin = Settings.defaults.global.pianorollDrawOffset;
        for (var i = _this.barWidth; i < _this.pianorollCanvas.width; i = i + _this.barWidth) {
            if (i > _this.barWidth) {
                _this.barsContext.fillText(Math.round(i / _this.barWidth), i - _this.barWidth + initialMargin - 2, 16);
                _this.pianorollContext.beginPath();
                _this.pianorollContext.moveTo(i - _this.barWidth + initialMargin, 10);
                _this.pianorollContext.lineTo(i - _this.barWidth + initialMargin, _this.pianorollCanvas.height - 20);
            } else {
                _this.barsContext.fillText(i / _this.barWidth, initialMargin - 2, 16);
                _this.pianorollContext.beginPath();
                _this.pianorollContext.moveTo(initialMargin, 10);
                _this.pianorollContext.lineTo(initialMargin, _this.pianorollCanvas.height - 20);
            }
            _this.pianorollContext.stroke();
        }
    };
    // draw beats on pianoroll
    _this.drawPianoRollBeats = function () {
        _this.pianorollContext.lineWidth = 1;
        _this.pianorollContext.strokeStyle = '#efefef';
        var initialMargin = Settings.defaults.global.pianorollDrawOffset;
        for (var i = initialMargin; i < _this.pianorollCanvas.width; i = i + _this.beatWidth) {
            _this.pianorollContext.beginPath();
            if (i > initialMargin) {
                _this.pianorollContext.moveTo(i, 20);
                _this.pianorollContext.lineTo(i, _this.pianorollCanvas.height - 20);
            } else {
                _this.pianorollContext.moveTo(initialMargin, 20);
                _this.pianorollContext.lineTo(initialMargin, _this.pianorollCanvas.height - 20);
            }
            _this.pianorollContext.stroke();
        }
    };
    // draw time on pianoroll
    _this.drawTime = function (tempo) {
        _this.timeContext.clearRect(0, 0, _this.timeCanvas.width, _this.timeCanvas.height);
        _this.timeContext.fillStyle = "#a29292";
        _this.timeContext.font = "10px Arial";
        _this.timeContext.lineWidth = 1;
        _this.timeContext.strokeStyle = '#D5D5D5';
        var initialMargin = Settings.defaults.global.pianorollDrawOffset;
        // the width of 1 second in pianoroll
        _this.secWidth = tempo / 60 * _this.beatWidth;
        var seconds = 0.00;
        var minutes = 0.00;
        for (var i = 0; i < _this.timeCanvas.width; i = i + _this.secWidth) {
            if (seconds + minutes > minutes + 0.60) {
                minutes += 1.00;
                seconds = 0.00;
            }
            if (i === 0) {
                _this.timeContext.fillText((parseFloat(minutes) + parseFloat(seconds)).toFixed(2), i + initialMargin, 20);
                _this.timeContext.beginPath();
                _this.timeContext.moveTo(i + initialMargin, 2);
                _this.timeContext.lineTo(i + initialMargin, 10);
            } else {
                _this.timeContext.fillText((parseFloat(minutes) + parseFloat(seconds)).toFixed(2), i + initialMargin, 20);
                _this.timeContext.beginPath();
                _this.timeContext.moveTo(i + initialMargin, 2);
                _this.timeContext.lineTo(i + initialMargin, 10);
            }
            _this.timeContext.stroke();
            seconds += 0.01;
        }
    };
    // pianoroll drawing
    _this.draw = function () {
        _this.drawPianoRollNotes();
        _this.drawPianoRollBars();
        _this.drawPianoRollBeats();
        _this.drawTime(_this.tempo);
        return {notesOverlayCanvas: _this.notesOverlayCanvas, notesOverlayContext: _this.notesOverlayContext};
    };
    // clear canvas
    _this.clearNotes = function () {
        _this.notesOverlayContext.clearRect(0, 0, _this.notesOverlayCanvas.width, _this.notesOverlayCanvas.height);
    };
    // redraw notes after correction
    _this.redrawNotesCorrected = function (composedTrack) {                                         // draw all notes together after characterization corrected
        _this.clearNotes();

        // rendered Single note objects as rectangles
        _this.drawer.renderNotes(composedTrack);
    };
};

/**
 * pianorollDrawer() draw on composition pianoroll
 *
 */
VisualDevices.drawers.pianorollDrawer = function () {
    var _this = this;
    _this.notesOverlayCanvas = NOTESOVERLAY;
    _this.notesOverlayContext = _this.notesOverlayCanvas.getContext('2d');
    _this.snapshotColor = Settings.defaults.global.drawableNotesColor;
    _this.signalColor = "grey";
    _this.snapshotThickness = 1;
    _this.notesOverlayContext.fillStyle = _this.snapshotColor;
    _this.notesOverlayContext.globalAlpha = 0.6;

    // delay maybe from the mic in or the web audio api or the browser
    var unknownOffsetDelay = 10;

    _this.renderSnapshots = function (bufferedSnapshots, pspc, cursorMove) {
        if (cursorMove) {
            // find the relation of rates between the two dynamic rate threads
            var threadRateRelation = Settings.getters.getSystemThreadRate() / Settings.getters.getVisualThreadRate();

            // the offset between the two threads frequency
            var threadsFrequencyOffset = (pspc - _this.snapshotThickness / threadRateRelation) / 2;

            var drawable = [];
            for (var i = 0; i < bufferedSnapshots.length; i++)
                drawable.push({posX: bufferedSnapshots[i].xCanvasPosition + Settings.defaults.global.pianorollDrawOffset - threadsFrequencyOffset, posY: _this.returnNoteHeight(bufferedSnapshots[i].note + bufferedSnapshots[i].octave) + 3, width: _this.snapshotThickness + threadsFrequencyOffset, height: 7});

            _this.notesOverlayContext.beginPath();
            for (var i = 0; i < bufferedSnapshots.length; i++) {

                _this.notesOverlayContext.fillRect(drawable[i].posX, drawable[i].posY, drawable[i].width, drawable[i].height);
                _this.notesOverlayContext.stroke();
            }

            return performance.now();
        }
    };
    _this.renderNotes = function (composedTrack) {
        for (var i = 0; i < composedTrack.length; i++) {
            var note = composedTrack[i].note + composedTrack[i].octave;
            var posX = composedTrack[i].snapshots[0].xCanvasPosition;
            var noteWidth = composedTrack[i].snapshots[composedTrack[i].snapshots.length - 1].xCanvasPosition - composedTrack[i].snapshots[0].xCanvasPosition;
            var color = Settings.defaults.global.correctedNotesColor;
            _this.notesOverlayContext.beginPath();
            _this.notesOverlayContext.fillStyle = color;
            _this.notesOverlayContext.globalAlpha = 0.5;
            var posY = _this.returnNoteHeight(note);
            _this.notesOverlayContext.fillRect(posX + Settings.defaults.global.pianorollDrawOffset, posY + 3, noteWidth * 0.95, 7); // multiply the noteWidth with 0.95 to avoid 2 notes in serie to appear as one

            _this.notesOverlayContext.font = "16px Arial";
            _this.notesOverlayContext.fillText(composedTrack[i].snapshots.length, posX + Settings.defaults.global.pianorollDrawOffset, posY + 3);
//            _this.notesOverlayContext.font = "12px Arial";
//            _this.notesOverlayContext.fillText(i, posX + Settings.defaults.global.pianorollDrawOffset + 15, posY + 3);
//            console.log(composedTrack[i].snapshots);
            _this.notesOverlayContext.stroke();
        }
    }
    _this.returnNoteHeight = function (note) {
        var posY = _this.notesOverlayCanvas.height;
        switch (note) {
            case "C0":
                return posY - 20;
            case "C#0":
                return posY - 30;
            case "D0":
                return posY - 40;
            case "D#0":
                return posY - 50;
            case "E0":
                return posY - 60;
            case "F0":
                return posY - 70;
            case "F#0":
                return posY - 80;
            case "G0":
                return posY - 90;
            case "G#0":
                return posY - 100;
            case "A0":
                return posY - 110;
            case "A#0":
                return posY - 120;
            case "B0":
                return posY - 130;
            case "C1":
                return posY - 140;
            case "C#1":
                return posY - 150;
            case "D1":
                return posY - 160;
            case "D#1":
                return posY - 170;
            case "E1":
                return posY - 180;
            case "F1":
                return posY - 190;
            case "F#1":
                return posY - 200;
            case "G1":
                return posY - 210;
            case "G#1":
                return posY - 220;
            case "A1":
                return posY - 230;
            case "A#1":
                return posY - 240;
            case "B1":
                return posY - 250;
            case "C2":
                return posY - 260;
            case "C#2":
                return posY - 270;
            case "D2":
                return posY - 280;
            case "D#2":
                return posY - 290;
            case "E2":
                return posY - 300;
            case "F2":
                return posY - 310;
            case "F#2":
                return posY - 320;
            case "G2":
                return posY - 340;
            case "G#2":
                return posY - 350;
            case "A2":
                return posY - 360;
            case "A#2":
                return posY - 370;
            case "B2":
                return posY - 380;
            case "C3":
                return posY - 390;
            case "C#3":
                return posY - 400;
            case "D3":
                return posY - 410;
            case "D#3":
                return posY - 420;
            case "E3":
                return posY - 430;
            case "F3":
                return posY - 440;
            case "F#3":
                return posY - 450;
            case "G3":
                return posY - 460;
            case "G#3":
                return posY - 470;
            case "A3":
                return posY - 480;
            case "A#3":
                return posY - 490;
            case "B3":
                return posY - 500;
            case "C4":
                return posY - 510;
            case "C#4":
                return posY - 520;
            case "D4":
                return posY - 530;
            case "D#4":
                return posY - 540;
            case "E4":
                return posY - 550;
            case "F4":
                return posY - 560;
            case "F#4":
                return posY - 570;
            case "G4":
                return posY - 580;
            case "G#4":
                return posY - 590;
            case "A4":
                return posY - 600;
            case "A#4":
                return posY - 610;
            case "B4":
                return posY - 620;
            case "C5":
                return posY - 630;
            case "C#5":
                return posY - 640;
            case "D5":
                return posY - 650;
            case "D#5":
                return posY - 660;
            case "E5":
                return posY - 670;
            case "F5":
                return posY - 680;
            case "F#5":
                return posY - 690;
            case "G5":
                return posY - 700;
            case "G#5":
                return posY - 710;
            case "A5":
                return posY - 720;
            case "A#5":
                return posY - 730;
            case "B5":
                return posY - 740;
            case "C6":
                return posY - 750;
            case "C#6":
                return posY - 760;
            case "D6":
                return posY - 770;
            case "D#6":
                return posY - 780;
            case "E6":
                return posY - 790;
            case "F6":
                return posY - 800;
            case "F#6":
                return posY - 810;
            case "G6":
                return posY - 820;
            case "G#6":
                return posY - 830;
            case "A6":
                return posY - 840;
            case "A#6":
                return posY - 850;
            case "B6":
                return posY - 860;
            case "C7":
                return posY - 870;
            case "C#7":
                return posY - 880;
            case "D7":
                return posY - 890;
            case "D#7":
                return posY - 900;
            case "E7":
                return posY - 910;
            case "F7":
                return posY - 920;
            case "F#7":
                return posY - 930;
            case "G7":
                return posY - 940;
            case "G#7":
                return posY - 950;
            case "A7":
                return posY - 960;
            case "A#7":
                return posY - 970;
            case "B7":
                return posY - 980;
        }
    };
};

/**
 * overlayDrawer() draw on a transparent overlay canvas front of pianoroll, 
 * currently used for time cursor only
 *
 */
VisualDevices.drawers.overlayDrawer = function () {
    var _this = this;
    _this.overlayCanvas = OVERLAY;
    _this.overlayContext = _this.overlayCanvas.getContext('2d');
    _this.overlayCanvas.width = Settings.defaults.global.canvasWidth;
    _this.overlayCanvas.height = 1000;
    _this.overlayContext.lineWidth = 0.5;

    // time cursor
    _this.moveCursor = function (posX) {
        _this.overlayContext.clearRect(0, 0, _this.overlayCanvas.width, _this.overlayCanvas.height);
        _this.overlayContext.beginPath();
        _this.overlayContext.strokeStyle = '#C8C8C8';
        _this.overlayContext.globalAlpha = 1;
        _this.overlayContext.moveTo(posX + Settings.defaults.global.pianorollDrawOffset, 20);
        _this.overlayContext.lineTo(posX + Settings.defaults.global.pianorollDrawOffset, _this.overlayCanvas.height - 20);
        _this.overlayContext.stroke();

        // start fade out if it appears
        if (_this.colorOpacityWorkflow.currentColoredLineOpacity !== 0) {
            _this.fadeOutOpacity();
        }
        _this.overlayContext.beginPath();
        _this.overlayContext.strokeStyle = '#e24f3d';
        _this.overlayContext.globalAlpha = _this.colorOpacityWorkflow.currentColoredLineOpacity;
        _this.overlayContext.moveTo(posX + Settings.defaults.global.pianorollDrawOffset, 20);
        _this.overlayContext.lineTo(posX + Settings.defaults.global.pianorollDrawOffset, _this.overlayCanvas.height - 20);
        _this.overlayContext.stroke();
    };
    _this.clearCursor = function () {
        _this.overlayContext.clearRect(0, 0, _this.overlayCanvas.width, _this.overlayCanvas.height);
    };

    _this.colorOpacityWorkflow = {
        currentColoredLineOpacity: 0,
        opacitySteps: parseInt(Settings.defaults.global.visualThreadRate / (Settings.defaults.global.tempo / 10)),
        opacityStep: parseInt(Settings.defaults.global.visualThreadRate / (Settings.defaults.global.tempo / 10))
    };

    _this.changeColorOpacity = function () {
        _this.colorOpacityWorkflow.currentColoredLineOpacity = 1;
    };
    _this.fadeOutOpacity = function () {
        if (_this.colorOpacityWorkflow.opacityStep > 0) {
            _this.colorOpacityWorkflow.currentColoredLineOpacity = 1 * (_this.colorOpacityWorkflow.opacityStep / _this.colorOpacityWorkflow.opacitySteps);
            _this.colorOpacityWorkflow.opacityStep--;
        } else {
            _this.colorOpacityWorkflow.currentColoredLineOpacity = 0;
            _this.colorOpacityWorkflow.opacityStep = parseInt(Settings.defaults.global.visualThreadRate / (Settings.defaults.global.tempo / 10));
        }

    };
};

/**
 * volumeDrawer() draw on a curved line represent the input audio signal
 *
 */
VisualDevices.drawers.volumeDrawer = function () {
    var _this = this;
    _this.volumeCanvas = document.getElementsByClassName("volumeCanvas")[0];
    _this.volumeContext = _this.volumeCanvas.getContext('2d');
    _this.volumeCanvas.width = 300;
    _this.volumeCanvas.height = 42;

    _this.rate = (1000 / Settings.getters.getVolumeMeterThreadRate());

    _this.mask = document.getElementById("logoMask");

    _this.gradient = _this.volumeContext.createLinearGradient(0, 20, 0, 40);
    _this.gradient.addColorStop(1, '#DAA15C');
    _this.gradient.addColorStop(0.75, '#DAA15C');
    _this.gradient.addColorStop(0.5, '#000000');
    _this.gradient.addColorStop(0, '#DAA15C');

    _this.analyser = audioContext.createAnalyser();
    _this.analyser.fftSize = 1024;
    _this.input = _this.analyser;

    // request animation frame workflow variables
    var requestId = 0;
    var fpsInterval = _this.rate;
    var then = 0;
    var startTime, now, then, elapsed;
    // shim layer with setTimeout fallback
    window.requestAnimFrame = (function () {
        return  window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame;
    })();
    window.cancelAnimFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;

    _this.drawSignal = function () {

        requestId = requestAnimFrame(_this.drawSignal);
        // throttle requestAnimationFrame to a specific frame rate
        now = Date.now();
        elapsed = now - then;
        // if enough time has elapsed, draw the next frame
        if (elapsed > fpsInterval) {
            // Get ready for next frame by setting then=now, but also adjust for your
            // specified fpsInterval not being a multiple of RAF's interval
            then = now - (elapsed % fpsInterval);

            _this.volumeContext.save();
            _this.volumeContext.drawImage(_this.mask, 0, 0);
            _this.volumeContext.globalCompositeOperation = "source-in";
            _this.volumeContext.fillStyle = _this.gradient;
            _this.volumeContext.fillRect(0, 0, _this.volumeCanvas.width, _this.volumeCanvas.height);
            _this.volumeContext.globalCompositeOperation = "destination-atop";
            _this.volumeContext.drawImage(_this.mask, 0, 0);

            var bufferLength = _this.analyser.frequencyBinCount;
            var dataArray = new Uint8Array(bufferLength);
            _this.analyser.getByteFrequencyData(dataArray);
            dataArray = _this.runningMedian(dataArray)
            _this.volumeContext.lineWidth = 40;
            _this.volumeContext.strokeStyle = '#ececec';
            _this.volumeContext.beginPath();
            var sliceWidth = 900 * 2.0 / bufferLength;
            var x = -100;

            for (var i = 0; i < bufferLength; i++) {
                var v = null;
                v = dataArray[i] / 512.0;
                var y = v * 128;

                if (i === 0) {
                    _this.volumeContext.moveTo(x, y + 10);
                } else {
                    _this.volumeContext.lineTo(x, y + 10);
                }

                x += sliceWidth;
            }
            _this.volumeContext.lineTo(_this.volumeCanvas.width, _this.volumeCanvas.height / 2 + 10);
            _this.volumeContext.stroke();

            _this.volumeContext.restore();
        }
    };

    _this.runningMedian = function (signal) {
        var dynamicThresholds = [];
        var d = 0;
        var l = 1;
        for (var i = 0; i < signal.length; ++i) {
            dynamicThresholds[i] = (d + l) * _this.median(signal[i]);                  // d -> constant threshold , l -> positive constant
        }
        return dynamicThresholds;
    }
    _this.createMedianFilter = function (length) {
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
    _this.median = _this.createMedianFilter(32);

    _this.stopDraw = function () {
        cancelAnimFrame(requestId);
        requestId = 0;
    };
    _this.drawStatic = function () {
        _this.volumeContext.drawImage(_this.mask, 0, 0);
    };
};

/**
 * momentaryOutput() indicate the current snapshot transcripted details
 *
 */
VisualDevices.indicators.momentaryOutput = function () {
    var _this = this;
    _this.detector = document.getElementById("detector");
    _this.pitch = document.getElementById("pitch");
    _this.note = document.getElementById("note");
    _this.detune = document.getElementById("detune");
    _this.detuneAmount = document.getElementById("detune_amt");
    _this.tempo = document.getElementById("tempo");
    _this.indicate = function (drawableSnapshot, tempo) {
        if (drawableSnapshot instanceof ErrorSnapshot || drawableSnapshot instanceof SilenceSnapshot) {
            _this.detector.className = "vague";
            _this.pitch.innerText = "--";
            _this.note.innerText = "-";
            _this.detune.className = "";
            _this.detuneAmount.innerText = "--";
        } else if (drawableSnapshot instanceof NoteSnapshot) {
            _this.detector.className = "confident";
            _this.pitch.innerText = Math.round(drawableSnapshot.pitch);
            _this.note.innerHTML = drawableSnapshot.note + drawableSnapshot.octave;
            if (drawableSnapshot.detune === 0) {
                _this.detune.className = "";
                _this.detuneAmount.innerHTML = "--";
            } else {
                if (drawableSnapshot.detune < 0)
                    _this.detune.className = "flat";
                else
                    _this.detune.className = "sharp";
                _this.detuneAmount.innerHTML = Math.abs(drawableSnapshot.detune);
            }
        }
        if (Settings.defaults.global.autoRecognizeTempo)
            _this.tempo.value = Settings.getters.getTempo();
    };
};

/**
 * momentaryOutput() indicate the current snapshot transcripted details
 *
 */
VisualDevices.indicators.tunerOutput = function () {
    var _this = this;
    _this.detector = document.getElementById("tunerDetector");
    _this.pitch = document.getElementById("tunerPitch");
    _this.note = document.getElementById("tunerNote");
    _this.detune = document.getElementById("tunerDetune");
    _this.detuneAmount = document.getElementById("tunerDetune_amt");
    _this.indicate = function (pitch, note, octave, detune) {
        if (pitch === -1 || pitch === 11025) {
            _this.detector.className = "vague";
            _this.pitch.innerText = "--";
            _this.note.innerText = "-";
            _this.detune.className = "";
            _this.detuneAmount.innerText = "--";
        } else {
            _this.detector.className = "confident";
            _this.pitch.innerText = Math.round(pitch);
            _this.note.innerHTML = note + octave;
            if (detune === 0) {
                _this.detune.className = "";
                _this.detuneAmount.innerHTML = "--";
            } else {
                if (detune < 0)
                    _this.detune.className = "flat";
                else
                    _this.detune.className = "sharp";
                _this.detuneAmount.innerHTML = Math.abs(detune);
            }
        }
    };
};

/**
 * NoteSnapshot() is a constructor of notesnapshot objects
 *
 */
function NoteSnapshot(pitch, isOnset, tempo, notePointer, currentTimestamp, xCanvasPosition, snapshotAmp) {
    var _this = this;
    _this.pointer = notePointer;
    _this.pitch = pitch;
    _this.xCanvasPosition = xCanvasPosition;
    _this.isOnset = isOnset;
    // the amplitude after the onset detection function
    _this.amp = snapshotAmp;
    _this.isOffset = false;
    _this.timestamp = currentTimestamp;
    _this.bpm = tempo;
    _this.draft = "";
    _this.noteFromPitch = function (frequency) {
        var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        return Math.round(noteNum) + 57; // for 8 octaves
    };
    _this.centsOffFromPitch = function (frequency, note) {
        return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
        function frequencyFromNoteNumber(note) {
            return 440 * Math.pow(2, (note - 57) / 12); // for 8 octaves
        }
    };
    _this.correctNote = function (pitch) {
        _this.pitch = pitch;
        try {
            _this.note = Settings.static.noteStrings[_this.noteFromPitch(_this.pitch) % 96].match(/[A-G+#]/gi).join('');
        } catch (err) {
        }
        _this.detune = _this.centsOffFromPitch(_this.pitch, _this.noteFromPitch(_this.pitch));
        try {
            _this.octave = Settings.static.noteStrings[_this.noteFromPitch(_this.pitch) % 96].match(/[0-9]+/g).map(function (n)
            {
                //just coerce to numbers
                return +(n);
            })[0];
        } catch (err) {
        }
    };
    _this.detune = _this.centsOffFromPitch(_this.pitch, _this.noteFromPitch(_this.pitch));
    try {
        _this.note = Settings.static.noteStrings[_this.noteFromPitch(_this.pitch) % 96].match(/[A-G+#]/gi).join('');
    } catch (err) {
    }

    try {
        _this.octave = Settings.static.noteStrings[_this.noteFromPitch(_this.pitch) % 96].match(/[0-9]+/g).map(function (n)
        {//just coerce to numbers
            return +(n);
        })[0];
    } catch (err) {
    }
}

/**
 * SingleNote() is a constructor of note objects,
 * this is produced of note snapshots in row
 *
 */
function SingleNote(noteStartPointer, noteEndPointer, snapshots) {
    var _this = this;
    _this.snapshots = snapshots || [];
    _this.onsetSnapshot = noteStartPointer || 0;
    _this.offsetSnapshot = noteEndPointer || 0;
    _this.pitch = null;
    _this.note = null;
    _this.octave = null;
    _this.bpm = null;
    _this.timestamp = null;
    _this.timeDuration = null;
    _this.setNoteDetails = function () {
        _this.pitch = _this.snapshots[0].pitch || 0;
        _this.note = _this.snapshots[0].note || 0;
        _this.octave = _this.snapshots[0].octave || 0;
        _this.bpm = _this.snapshots[0].bpm || 0;
        _this.timestamp = _this.snapshots[0].timestamp;
        _this.timeDuration = _this.snapshots[_this.snapshots.length - 1].timestamp - _this.snapshots[0].timestamp;
    }
    _this.processNoteSnapshots = function (snapShots) {
        var snapshotPitches = [];
        var snapshotBPM = [];
//        console.log("---------");
//        console.log(i);
        for (var i = 0; i < snapShots.length; i++) {
//            console.log(snapShots[i]);
            snapshotPitches.push(snapShots[i].pitch);
            snapshotBPM.push(snapShots[i].bpm);
        }

        var mostCommonPitch = getMaxOccurrence(snapshotPitches);
        var mostCommonBPM = getMaxOccurrence(snapshotBPM);
        for (var i = 0; i < snapShots.length; i++) {
            var tempPos = snapShots[i].xCanvasPosition;
            var tempAmp = snapShots[i].amp;
            var tempPointer = snapShots[i].pointer;
            var tempTimestamp = snapShots[i].timestamp;
            var tempIsOnset = snapShots[i].isOnset;
            var tempIsOffset = snapShots[i].isOffset;
            snapShots[i] = new NoteSnapshot(mostCommonPitch, tempPointer);
            snapShots[i].xCanvasPosition = tempPos;
            snapShots[i].amp = tempAmp;
            snapShots[i].pointer = tempPointer;
            snapShots[i].timestamp = tempTimestamp;
            snapShots[i].isOnset = tempIsOnset;
            snapShots[i].isOffset = tempIsOffset;
            snapShots[i].bpm = mostCommonBPM;
        }

        _this.snapshots = snapShots;

        // get the most common value in an array
        function getMaxOccurrence(array) {
            var o = {}, mC = 0, mV, m;
            for (var i = 0, iL = array.length; i < iL; i++) {
                m = array[i];
                o.hasOwnProperty(m) ? ++o[m] : o[m] = 1;
                if (o[m] > mC)
                    mC = o[m], mV = m;
            }
            return mV;
        }
    };

    _this.processNoteSnapshots(_this.snapshots);
    _this.setNoteDetails();
}

/**
 * SilenceSnapshot() is a constructor of silence snapshots objects
 *
 */
function SilenceSnapshot(silencePointer, currentTimestamp, xCanvasPosition, snapshotAmp) {
    var _this = this;
    _this.pointer = silencePointer;
    _this.timestamp = currentTimestamp || 0;
    _this.xCanvasPosition = xCanvasPosition || 0;
    // this is the amplitude after the onset detection function
    _this.amp = snapshotAmp || 0;
}

/**
 * ErrorSnapshot() is a constructor of error snapshots objects
 *
 */
function ErrorSnapshot(errorPointer, currentTimestamp, xCanvasPosition, snapshotAmp) {
    var _this = this;
    _this.pointer = errorPointer;
    _this.timestamp = currentTimestamp;
    _this.xCanvasPosition = xCanvasPosition;
    // this is the amplitude after the onset detection function
    _this.amp = snapshotAmp;
    _this.note = 0;
    _this.isOnset = false;
}

/**
 * SamplerNote() is a constructor for notes for the sampler workflow 
 * (these are like signle notes objects)
 *
 */
function SamplerNote(note, octave, velocity, timeStamp, duration) {
    var _this = this;

    _this.note = note.replace("#", "S") || note;
    _this.octave = octave;
    _this.velocity = velocity || 1;
    _this.timeStamp = timeStamp;
    _this.duration = duration;
    _this.sampleBuffer = null;
    _this.sampleIndex = 0;
    _this.setSample = function (buffer) {
        _this.sampleBuffer = buffer;
    };
    _this.setAsLoaded = function () {
        _this.isLoaded = true;
    };

    _this.SetSampleIndex = function (index) {
        _this.sampleIndex = index;
    }
}


/**
 * addListeners() add listeners to a predefined list of DOM elements
 * 
 * @param {object} workspace is the workspace object of the app
 *
 */
Events.system.addListeners = function (workspace) {

    // assing DOM elements to variables
    var audioInput = document.getElementById("audio-input-btn");
    var selectInstrument = document.getElementById("instrumentSelection");
    var selectMicSource = document.getElementById("selectMicSource");
    var selectSampleSource = document.getElementById("selectSampleSource");
    var micReady = document.getElementById("micReady");
    var changePrecision = document.getElementById("changePrecision");
    var changeAutocorrect = document.getElementById("changeAutocorrect");
    var changeGain = document.getElementById("changeGain");
    var startTranscription = document.getElementById("startTranscription");
    var stop = document.getElementById("stop");
    var originalPlayback = document.getElementById("originalPlayback");
    var synthPlayback = document.getElementById("synthPlayback");
    var samplerPlayback = document.getElementById("samplerPlayback");
    var clear = document.getElementById("clear");
    var tempo = document.getElementById("tempo");
    var metronomeActivate = document.getElementById("metronomeActivate");
    var tap = document.getElementById("tap");
    var autoTempo = document.getElementById("autoTempo");
    // add listeners to elements
    selectInstrument.addEventListener("change", function () {
        workspace.events.selectInstrument(this.value);
        if (!$(selectInstrument).hasClass("selected")) {
            $("#select-input-modal .second-option").slideDown();
            $(selectInstrument).addClass("selected");
        }
    });
    selectMicSource.addEventListener("click", function () {
        workspace.events.selectMic();
        workspace.events.startTesting();
        workspace.workflowController.setState("MIC_TEST");
        $(selectSampleSource).attr("disabled", "disabled");
        $(selectSampleSource).addClass("disabled");
        $(audioInput).attr("disabled", "disabled");
        $(audioInput).addClass("disabled");
        $("#mic-config-modal").modal('show');
    });
    selectSampleSource.addEventListener("change", function (e) {
        workspace.events.selectSample(e);
        workspace.workflowController.setState("SAMPLE_READY");
        $(selectMicSource).attr("disabled", "disabled");
        $(selectMicSource).addClass("disabled");
        $('#select-input-modal').modal('hide');
        $(audioInput).attr("disabled", "disabled");
        $(audioInput).addClass("disabled");
    });
    micReady.addEventListener("click", function () {
        workspace.events.stopTesting();
        workspace.workflowController.setState("MIC_READY");
    });
    changePrecision.addEventListener("change", function () {
        workspace.events.changePrecision(this.value);
    });
    changeAutocorrect.addEventListener('change', function () {
        workspace.events.changeAutocorrect($(changeAutocorrect).is(':checked'));
    });
    changeGain.addEventListener("change", function () {
        workspace.events.changeGain(this.value);
    });
    startTranscription.addEventListener("click", function () {
        if (workspace.workflowController.state === 'MIC_READY' || workspace.workflowController.state === 'SAMPLE_READY') {
            workspace.events.startTranscription();
            $("#audio-input-btn").attr("disabled", "disabled");
            $("#audio-input-btn").addClass("disabled");
        } else {
            workspace.workflowController.setState('NOT_READY');
        }
    });
    stop.addEventListener("click", function () {
        if (Settings.states.TRANSCRIBING)
            workspace.events.stopTranscription();
        else if (Settings.states.PLAY)
            workspace.events.stopPlayback();
    });
    originalPlayback.addEventListener("click", function () {
        $('#board').scrollLeft(0);
        workspace.events.originalPlayback();
    });
    synthPlayback.addEventListener("click", function () {
        $('#board').scrollLeft(0);
        workspace.events.synthPlayback();
    });
    samplerPlayback.addEventListener("click", function () {
        $('#board').scrollLeft(0);
        workspace.events.samplerPlayback();
    });
    clear.addEventListener("click", function () {
        workspace.workflowController.setState('REFRESHED');
        workspace.events.stopTranscription();
        ACTIVECOMPOSITION = null;
        ACTIVECHANNEL = null;
        PIANOROLL = null;
        TRACKMUSIC = null;
        SIMPLEANALYSER = null;
        THEFILE = null;
        Settings.states.TRANSCRIBING = false;
        Settings.states.PLAY = false;
        Settings.states.ORIGINALPLAY = false;
        Settings.states.SYNTHPLAY = false;
        Settings.states.SAMPLERPLAY = false;
        Settings.states.RECOGNIZING_BPM = false;
        audioContext = new window.AudioContext();
        TONEROLLDEMO = new Workspace();
        TONEROLLDEMO.pianoroll.clearNotes();
    });
    tempo.addEventListener("change", function () {
        workspace.events.changeTempo($(tempo).val());
    });
    metronomeActivate.addEventListener('change', function () {
        workspace.events.metronomeActivate($(metronomeActivate).is(':checked'));
    });
    tap.addEventListener("click", function () {
        workspace.events.tap();
    });
    autoTempo.addEventListener('change', function () {
        workspace.events.autoTempo($(autoTempo).is(':checked'));
    });
};

/**
 * pianoroll() handles the UI interactivity of the pianoroll and board containers
 *
 */
UI.panels.pianoroll = function () {
    // resizable & draggable
//    $('#board').draggable().resizable();

    // double scroll
//    $('#board').height(window.innerHeight * 0.8);
//    $('#board').width(window.innerWidth * 0.8);
//    $('#pianoroll > .doubleScroll').css("overflow", "auto");
//    $('#pianoroll > .doubleScroll').doubleScroll();

    function posDimInit() {
        $('#board').height(window.innerHeight - 60);
        $('#board .center-wrapper').height(window.innerHeight - 64);
        $('#board .bottom-wrapper').css("top", $('#board').height() - 50);
    }

    // initialize position and dimensions
    posDimInit();
    // change position and dimensions on window resize
    $(window).resize(function () {
        posDimInit();
    });
    // pianoroll click and drag scroll
    $(function () {
        var curDown = false,
                curYPos = 0,
                curXPos = 0;
        $("#board").mousemove(function (m) {
            if (curDown === true) {
                $("#board").scrollTop($("#board").scrollTop() + (curYPos - m.pageY) / 80);
                $("#board").scrollLeft($("#board").scrollLeft() + (curXPos - m.pageX) / 80);
            }
        });
        $("#board").mousedown(function (m) {
            curDown = true;
            curYPos = m.pageY;
            curXPos = m.pageX;
        });
        $("#board").mouseup(function () {
            curDown = false;
        });
    });
    $("#board").scrollTop(((1000 - $("#pianoroll").height()) / 2) + 30);
    // time, notes, and bars symbols follow scrolling actions
    $('#board').scroll(function () {
        $("#pianoroll .left-wrapper").css("margin-top", 0 - $(this).scrollTop());
        $("#pianoroll .top-wrapper").css("margin-left", 0 - $(this).scrollLeft());
        $("#pianoroll .bottom-wrapper").css("margin-left", 0 - $(this).scrollLeft());
    });
};

/**
 * followDraw() is a method for apply scroll follow to the cursor move
 * @param {int} position is the current x cursor position
 *
 */
UI.draw.followDraw = function (position) {
    $('#board').scrollLeft(position - ($('#board').width() / 1.5));
};

/**
 * getHelp() change the user help text based on the mouse hover
 *
 */
UI.reactions.getHelp = function () {
    // hide all and rest to default help text
    function resetDefault() {
        $("#help .info").hide();
        $("#help .default").show();
    }

    $("#indicator .pitch").mouseenter(function () {
        $("#help .info").hide();
        $("#help .indicatorPitch").show();
    }).mouseleave(function () {
        resetDefault();
    });
    $("#indicator .note").mouseenter(function () {
        $("#help .info").hide();
        $("#help .indicatorNote").show();
    }).mouseleave(function () {
        resetDefault();
    });
    $("#indicator .detune").mouseenter(function () {
        $("#help .info").hide();
        $("#help .indicatorDetune").show();
    }).mouseleave(function () {
        resetDefault();
    });
    $("#indicator .tempo").mouseenter(function () {
        $("#help .info").hide();
        $("#help .indicatorTempo").show();
    }).mouseleave(function () {
        resetDefault();
    });
    $("#pianoroll .barsCanvas").mouseenter(function () {
        $("#help .info").hide();
        $("#help .pianorollBars").show();
    }).mouseleave(function () {
        resetDefault();
    });
    $("#pianoroll .notesCanvas").mouseenter(function () {
        $("#help .info").hide();
        $("#help .pianorollNotes").show();
    }).mouseleave(function () {
        resetDefault();
    });
    $("#pianoroll .timeCanvas").mouseenter(function () {
        $("#help .info").hide();
        $("#help .pianorollTime").show();
    }).mouseleave(function () {
        resetDefault();
    });
    $("#pianoroll .center-wrapper").mouseenter(function () {
        $("#help .info").hide();
        function PianoRollPos(notesOverlayCanvasHeight) {

            var _this = this;
            _this.bar;
            _this.bit;
            _this.note;
            _this.octave;
            _this.notesOverlayCanvasHeight = notesOverlayCanvasHeight;

            _this.set = function (xCord, yCord) {

                var tmpX = (xCord / 80) + 1;
                var offset = 20;
                _this.bar = parseInt(tmpX);
                _this.bit = parseInt((parseInt((tmpX - _this.bar) * 10)) / 2);

                var tmpY = (((_this.notesOverlayCanvasHeight - offset) - (yCord)) / 12);

                _this.octave = parseInt(tmpY / 10);
                var tmpNote = parseInt((tmpY - _this.octave * 10) * 1.2);
                if (tmpNote == 0)
                    _this.note = 'C';
                if (tmpNote == 1)
                    _this.note = 'C#';
                if (tmpNote == 2)
                    _this.note = 'D';
                if (tmpNote == 3)
                    _this.note = 'D#';
                if (tmpNote == 4)
                    _this.note = 'E';
                if (tmpNote == 5)
                    _this.note = 'F';
                if (tmpNote == 6)
                    _this.note = 'F#';
                if (tmpNote == 7)
                    _this.note = 'G';
                if (tmpNote == 8)
                    _this.note = 'G#';
                if (tmpNote == 9)
                    _this.note = 'A';
                if (tmpNote == 10)
                    _this.note = 'A#';
                if (tmpNote == 11)
                    _this.note = 'B';
            };

            _this.copyFrom = function (PnPos) {
                _this.bar = PnPos.bar;
                _this.bit = PnPos.bit;
                _this.note = PnPos.note;
                _this.octave = PnPos.octave;

            };

            _this.compare = function (PnPos) {
                if (!PnPos)
                    return null;

                var flag = true;

                if (_this.bar != PnPos.bar)
                    flag = false;

                if (_this.bit != PnPos.bit)
                    flag = false;

                if (_this.note != PnPos.note)
                    flag = false;

                if (_this.octave != PnPos.octave)
                    flag = false;

                return flag;
            };

            _this.toString = function () {
                return _this.bar + "." + _this.bit + " " + _this.note + _this.octave;
            }

        }
        ;
        function getMousePos(canvas, evt) {
            var rect = canvas.getBoundingClientRect();
            return {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };
        }
        var canvas = document.getElementById('topCanvas');
        var currentNote = document.getElementById('currentNote');
        var currentPnPos = new PianoRollPos(canvas.height);
        var lastPnPos = new PianoRollPos(canvas.height);
        canvas.addEventListener('mousemove', function (evt) {
            var mousePos = getMousePos(canvas, evt);
            currentPnPos.set(mousePos.x, mousePos.y);
            if (!currentPnPos.compare(lastPnPos)) {
                currentNote.innerHTML = currentPnPos.toString();
                lastPnPos.copyFrom(currentPnPos);
            }
        }, false);
        $("#help .pianorollMidi").show();


    }).mouseleave(function () {
        resetDefault();
        $("#currentNote").html("");
    });
};

/**
 * buttons() initialize button reactions 
 *
 */
UI.reactions.buttons = function () {     //toggle transcribe/playback buttons when user stop the transcription
    $("#stop").click(function () {
        $("#startTranscription").fadeOut(500, function () {
            $("#startPlayback").fadeIn();
        });
    });
};

/**
 * reset() reset the UI elements to initial condition
 *
 */
UI.reset = function () {
    $('#board').scrollLeft(0);
    $("#startPlayback").hide();
    $("#startTranscription").show();
    $('button').each(function () {
        $(this).removeAttr('disabled');
        $(this).removeClass("disabled");
    });
    $('input').each(function () {
        $(this).removeAttr('disabled');
        $(this).removeClass("disabled");
    });

};

/**
 * initialize() is the app UI initial load actions 
 *
 */
UI.initialize = function (workspace) {
    UI.reset();
    UI.panels.pianoroll();
    UI.reactions.buttons();
    UI.reactions.getHelp();
    $('#demo-intro-modal .modal-body').append("<p class='systemGrade'>Your system grade is " + systemStars + "/ 10</p>");
    $('#demo-intro-modal .modal-body').append("<p>NOTE: Minimum note value at " + Settings.defaults.global.tempo + " bpm is 1/" + Settings.defaults.global.minNoteValue.dynamic * 4 + "</p>");
    $('#demo-intro-modal').modal('show');
    $('#changePrecision')[0].value = Settings.defaults.global.systemThreadRate;
};

/**
 * global is a namespace for store global default values
 *
 */
Settings.defaults.global = {tempo: 120, // {BPM}
    minTempo: 40,
    maxTempo: 200,
    autoRecognizeTempo: false,
    metronomeActive: false,
    beatTimestamp: 0,
    masterVolume: 1,
    systemThreadRate: 60, // {Hz} 
    visualThreadRate: 30, // {Hz} 
    volumeMeterThreadRate: 25, // {Hz} 
    pitchDetectorFFTSize: 2048,
    onsetDetectorFFTSize: 2048,
    onsetDetectorFrameSize: 1024,
    onsetDetectorFrameOverlap: 0,
    recorderBufferLength: 4096,
    minNoteValue: {static: 8, dynamic: 8}, // 8 means 1/32
    noteMinSnapshots: {static: 5, dynamic: 5},
    maximize: 4,
    normalizeFrameSize: 64,
    beatWidth: function () {
        if (window.innerWidth > 768)
            return (this.tempo / 60) * (window.innerWidth / 100);
        else if (window.innerWidth >= 480 && window.innerWidth <= 768)
            return (this.tempo / 60) * (window.innerWidth / 40);
        else if (window.innerWidth < 480)
            return (this.tempo / 60) * (window.innerWidth / 20);
    }, // based on user device - default was (BPS = BPM / 60) * 20
    drawableNotesColor: '#e24f3d',
    correctedNotesColor: '#36A78E',
    pianorollDrawOffset: 0,
    canvasWidth: window.innerWidth * 4,
    defaultInstrument: "piano"
};

/**
 * normalizer is a namespace for holding normalizer presets
 *
 */
Settings.defaults.normalizer = {onsetDetectedFrame: {factor: 1000, isInteger: false, frameSize: 8, noiseGate: 1},
    updatePitch: {factor: 256, isInteger: true, frameSize: Settings.defaults.global.pitchDetectorFFTSize, noiseGate: 48},
    updateOnsets: {factor: 1, isInteger: false, frameSize: Settings.defaults.global.onsetDetectorFFTSize, noiseGate: 0.5},
    simpleAnalyser: {factor: 1, isInteger: false, frameSize: Settings.defaults.global.normalizeFrameSize, noiseGate: 0.01}
};

/**
 * states is a namespace for holding states booleans for the global workflow
 *
 */
Settings.states = {
    TRANSCRIBING: false,
    TESTING: false,
    PLAY: false,
    ORIGINALPLAY: false,
    SYNTHPLAY: false,
    SAMPLERPLAY: false,
    RECOGNIZING_BPM: false,
};

/**
 * messages store all the ui messages
 *
 */
Settings.messages = {MIC_READY: "Microphone initialized! You can now start transcribing audio input by clicking REC!",
    SAMPLE_READY: "File loaded! You can now start transcribing audio input by clicking REC!", // in front of this message we need to add the loaded track name
    NOT_READY: "NOT_READY",
    LOADING: "Please wait",
    PLAYBACK_READY: "Transcription completed! You can now playback your composition by clicking PLAY!",
    RECOGNIZING_BPM: "Please play while toneroll recognizing your composition's tempo...",
    BPM_RECOGNIZED: "Tempo has been recognized! You can now start the transcription!",
    REFRESHED: "Toneroll workspace has been refreshed!",
    LOW_LEVEL: "LOW_LEVEL"
};

Settings.static = {noteStrings: ["C0", "C#0", "D0", "D#0", "E0", "F0", "F#0", "G0", "G#0", "A0", "A#0", "B0", "C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1", "C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2", "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3", "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4", "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5", "C6", "C#6", "D6", "D#6", "E6", "F6", "F#6", "G6", "G#6", "A6", "A#6", "B6", "C7", "C#7", "D7", "D#7", "E7", "F7", "F#7", "G7", "G#7", "A7", "A#7", "B7"]
};
Settings.user.ui = {
    autoFollow: true,
    metronomeFlash: true,
    volumeMeter: true,
    indicateOutput: true
};

Settings.setters = {
    setSystemThreadRate: function (rate) {
        Settings.defaults.global.systemThreadRate = rate;
        TONEROLLDEMO.masterRetriever.audioTranscriber.synchronizer.calculateMinResults(rate, Settings.defaults.global.tempo);
    },
    setVisualThreadRate: function (rate) {
        Settings.defaults.global.visualThreadRate = rate;
    },
    setTempo: function (bpm) {
        if (bpm < Settings.defaults.global.minTempo)
            bpm = Settings.defaults.global.minTempo;
        if (bpm > Settings.defaults.global.maxTempo)
            bpm = Settings.defaults.global.maxTempo;
        Settings.defaults.global.tempo = bpm;
        TONEROLLDEMO.masterRetriever.audioTranscriber.synchronizer.calculateMinResults(Settings.defaults.global.systemThreadRate, bpm);
        TONEROLLDEMO.pianoroll.drawTime(bpm);
        var tempoIndicator = document.getElementById("tempo");
        tempoIndicator.value = bpm;
        console.log(Settings.defaults.global.noteMinSnapshots);
    }
}
Settings.getters = {
    getSystemThreadRate: function () {
        return Settings.defaults.global.systemThreadRate;
    },
    getVisualThreadRate: function () {
        return Settings.defaults.global.visualThreadRate;
    },
    getVolumeMeterThreadRate: function () {
        return Settings.defaults.global.volumeMeterThreadRate;
    },
    getTempo: function () {
        return Settings.defaults.global.tempo;
    }
}

/**
 * instrumentPresets is a namespace to store all presets for input processing 
 * to improve transcritpion results
 *
 */
Settings.defaults.instrumentPresets = {
    vocals: {compressor: {threshold: -8,
            reduction: 8,
            knee: 6,
            ratio: 2,
            attack: 1,
            release: 30,
        },
        kind: {// Base the frequency bandwidth from the table -> http://www.independentrecording.net/irn/resources/freqchart/main_display.htm
            male: {filter: {// presets to be used on the noisereducer module - ParametricEQ orientation usage // LIKE Noise reducer presets
                    freqs: [100, 900],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            female: {filter: {// presets to be used on the noisereducer module - ParametricEQ orientation usage // LIKE Noise reducer presets
                    freqs: [200, 1200],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
        }
    },
    strings: {compressor: {threshold: -4,
            reduction: 4,
            knee: 6,
            ratio: 3,
            attack: 40,
            release: 80,
        },
        kind: {bass: {filter: {freqs: [41, 343],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            cello: {filter: {freqs: [56, 520],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            viola: {filter: {freqs: [125, 1000],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            violin: {filter: {freqs: [200, 1300],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            guitar: {filter: {freqs: [82, 1200],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            harp: {filter: {freqs: [29, 3100],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
        }
    },
    brass: {compressor: {threshold: -8,
            reduction: 8,
            knee: 6,
            ratio: 2.5,
            attack: 80,
            release: 250,
        },
        kind: {tuba: {filter: {freqs: [41, 343],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            frenchHorn: {filter: {freqs: [56, 520],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            bassTrombone: {filter: {freqs: [125, 1000],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            tenorTrombone: {filter: {freqs: [200, 1300],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            trumpet: {filter: {freqs: [82, 1200],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
        }
    },
    woodwinds: {compressor: {threshold: -8,
            reduction: 8,
            knee: 6,
            ratio: 2.5,
            attack: 80,
            release: 250,
        },
        kind: {constraBassoon: {filter: {freqs: [29, 200],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            bassoon: {filter: {freqs: [55, 575],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            tenorSax: {filter: {freqs: [120, 725],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            altoSax: {filter: {freqs: [139, 785],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            clarinet: {filter: {freqs: [139, 1600],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            oboe: {filter: {freqs: [250, 1500],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            flute: {filter: {freqs: [247, 2100],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
            piccolo: {filter: {freqs: [630, 4000],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            },
        }
    },
    piano: {
        compressor: {threshold: -10,
            reduction: 10,
            knee: 6,
            ratio: 6,
            attack: 40,
            release: 200,
        },
        kind: {standard88Key: {filter: {freqs: [27, 4200],
                    types: ["highpass", "lowpass"],
                    Qs: [1, 1]
                }
            }
        }
    }
};

/**
 * DRAFT DEMO CODING START HERE
 *
 */

function countCPU() {
    var time2 = performance.now();
    var counter = 0;
    for (var time1 = performance.now(); time2 < time1 + 10; counter++) {
        Math.random();
        time2 = performance.now();
    }
    return counter;
}

// currently counted on chrome only 
function adjustAppResources(counter) {
    var stars = null;
    if (counter < 250)
    {
        return stars = 0;
    }
    else if (counter > 250 && counter < 400)
    {
        Settings.defaults.global.systemThreadRate = 30;
        Settings.defaults.global.visualThreadRate = 10;
        Settings.user.ui.autoFollow = false;
        Settings.user.ui.indicateOutput = false;
        Settings.user.ui.metronomeFlash = false;
        Settings.user.ui.volumeMeter = false;
        return stars = 2;
        return stars = 1;
    }
    else if (counter > 400 && counter < 500)
    {
        Settings.defaults.global.systemThreadRate = 30;
        Settings.defaults.global.visualThreadRate = 15;
        Settings.user.ui.autoFollow = false;
        Settings.user.ui.indicateOutput = false;
        Settings.user.ui.metronomeFlash = false;
        Settings.user.ui.volumeMeter = false;
        return stars = 2;
    }
    else if (counter > 500 && counter < 800)
    {
        Settings.defaults.global.systemThreadRate = 40;
        Settings.defaults.global.visualThreadRate = 15;
        Settings.user.ui.autoFollow = false;
        Settings.user.ui.indicateOutput = false;
        Settings.user.ui.metronomeFlash = false;
        Settings.user.ui.volumeMeter = false;
        return stars = 3;
    }
    else if (counter > 800 && counter < 1500)
    {
        Settings.defaults.global.systemThreadRate = 40;
        Settings.defaults.global.visualThreadRate = 20;
        Settings.user.ui.autoFollow = false;
        Settings.user.ui.indicateOutput = false;
        Settings.user.ui.metronomeFlash = false;
        Settings.user.ui.volumeMeter = false;
        return stars = 4;
    }
    else if (counter > 1500 && counter < 3000)
    {
        Settings.defaults.global.systemThreadRate = 50;
        Settings.defaults.global.visualThreadRate = 20;
        Settings.user.ui.autoFollow = false;
        Settings.user.ui.metronomeFlash = false;
        Settings.user.ui.volumeMeter = false;
        return stars = 5;
    }
    else if (counter > 3000 && counter < 10000)
    {
        Settings.defaults.global.systemThreadRate = 60;
        Settings.defaults.global.visualThreadRate = 25;
        Settings.user.ui.metronomeFlash = false;
        Settings.user.ui.volumeMeter = false;
        return stars = 6;
    }
    else if (counter > 10000 && counter < 30000)
    {
        Settings.defaults.global.systemThreadRate = 70;
        Settings.defaults.global.visualThreadRate = 30;
        Settings.user.ui.volumeMeter = false;
        return stars = 7;
    }
    else if (counter > 30000 && counter < 80000)
    {
        Settings.defaults.global.systemThreadRate = 90;
        Settings.defaults.global.visualThreadRate = 30;
        Settings.defaults.global.volumeMeterThreadRate = 25;
        return stars = 8;
    }
    else if (counter > 80000 && counter < 200000)
    {
        Settings.defaults.global.systemThreadRate = 110;
        Settings.defaults.global.visualThreadRate = 30;
        Settings.defaults.global.volumeMeterThreadRate = 25;
        return stars = 9;
    }
    else if (counter > 200000)
    {
        Settings.defaults.global.systemThreadRate = 140;
        Settings.defaults.global.visualThreadRate = 40;
        Settings.defaults.global.volumeMeterThreadRate = 30;
        return stars = 10;
    }
}

var ACTIVECOMPOSITION = null;
var ACTIVECHANNEL = null;
var PIANOROLL = null;
//var MAXIMIZER = null;
var PIANOROLLCANVAS = document.getElementsByClassName("pianorollCanvas")[0];
var NOTESOVERLAY = document.getElementsByClassName("notesOverlayCanvas")[0];
var OVERLAY = document.getElementsByClassName("overlayCanvas")[0];
//var SIGNAL = document.getElementsByClassName("signalCanvas")[0];
var TRACKMUSIC = null;
var SIMPLEANALYSER = null;

var systemStars = adjustAppResources(countCPU());
if (systemStars !== 0) {
    var TONEROLLDEMO = new Workspace();
} else {
    alert("Sorry your system does not have the minimum requirements.")
}



// using a global for the file because we cannot achieve passing it through function param
var THEFILE = null;
Array.prototype.contains = function (needle) {
    for (var i in this) {
        if (this[i] === needle)
            return true;
    }
    return false;
};
/**
 * DRAFT DEMO CODING ENDS HERE
 *
 */


// DEBUG - QUICK TEST MIC
window.addEventListener("keydown", function () {
    TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets('guitar');
    TONEROLLDEMO.masterVolume.device.gain.value = 0;
    TONEROLLDEMO.compositions[TONEROLLDEMO.activeComposition].addChannel('userMic');
    TONEROLLDEMO.events.startTesting();
    TONEROLLDEMO.workflowController.setState("MIC_TEST");
    $("#mic-config-modal").modal('show');
}, false);

// DEBUG - QUICK CHANGE PITCH COMP AND EQ
//var pitchEQ = TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.equalizer;
//var pitchComp = TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.compressor;
//var pitchPreseter = TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter;

document.getElementById("threshold").addEventListener("change", function () {
    Settings.defaults.instrumentPresets.piano.compressor.threshold = this.value;
    TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets('piano');
    console.log(Settings.defaults.instrumentPresets.piano.compressor.threshold);
});
document.getElementById("reduction").addEventListener("change", function () {
    Settings.defaults.instrumentPresets.piano.compressor.reduction = this.value;
    TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets('piano');
    console.log(Settings.defaults.instrumentPresets.piano.compressor.reduction);
});
document.getElementById("knee").addEventListener("change", function () {
    Settings.defaults.instrumentPresets.piano.compressor.knee = this.value;
    TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets('piano');
    console.log(Settings.defaults.instrumentPresets.piano.compressor.knee);
});
document.getElementById("ratio").addEventListener("change", function () {
    Settings.defaults.instrumentPresets.piano.compressor.ratio = this.value;
    TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets('piano');
    console.log(Settings.defaults.instrumentPresets.piano.compressor.ratio);
});
document.getElementById("attack").addEventListener("change", function () {
    Settings.defaults.instrumentPresets.piano.compressor.attack = this.value;
    TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets('piano');
    console.log(Settings.defaults.instrumentPresets.piano.compressor.attack);
});
document.getElementById("release").addEventListener("change", function () {
    Settings.defaults.instrumentPresets.piano.compressor.release = this.value;
    TONEROLLDEMO.masterRetriever.audioTranscriber.pitchDetector.preseter.applyInstrumentPresets('piano');
    console.log(Settings.defaults.instrumentPresets.piano.compressor.release);
});
//
//Settings.defaults.instrumentPresets.piano.compressor.threshold
//Settings.defaults.instrumentPresets.piano.compressor.reduction
//Settings.defaults.instrumentPresets.piano.compressor.knee
//Settings.defaults.instrumentPresets.piano.compressor.ratio
//Settings.defaults.instrumentPresets.piano.compressor.attack
//Settings.defaults.instrumentPresets.piano.compressor.release
//Settings.defaults.instrumentPresets.piano.kind.standard88Key.filter.freqs
//Settings.defaults.instrumentPresets.piano.kind.standard88Key.filter.types
//Settings.defaults.instrumentPresets.piano.kind.standard88Key.filter.Qs

