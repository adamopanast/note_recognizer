//Web audio
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext();
var mediaStreamSource = null; //Mic source
var sourceNode = null; //Sample source
var theBuffer = null;
var now = null;
var isPlaying = false;
var isRecording = false;
var pitchAnalyserNode = null;
var onsetAnalyserNode = null;
var filterNode = null;
var compressorNode = null;
var onsetCompressorNode = null;
var preGainNode = null;
var limiterNode = null;
var micSelected = false;
var sampleSelected = false;
var scriptProccessorNode = null;
var instrumentEQNodes = null;
var scriptProccessorOutputData = null;
var sampleRate = audioContext.sampleRate;

//application
var initializer = {};
var audioUsher = {};
var actions = {};
var pitchDetector = {};
var onsetDetector = {};
var drawer = {};
var timer = {};
var ui = {};
var deBugger = {};
var intervalThread = null;
var sumOutput = {signal: new Array(), is: new Array()};                                         // one central array with objects to store results over time from onsetDetector and pitchDetector

//pitchdetector
var rafID = null;
var tracks = null;
var pitchAnalyserBuflen = 2048;
var pitchAnalyserTempBuf = null;
var MINVAL = 134;  // 128 == zero.  MINVAL is the "minimum detected signal" level.
var pitch = null;
var note = null;
var noteStrings = ["C0", "C#0", "D0", "D#0", "E0", "F0", "F#0", "G0", "G#0", "A0", "A#0", "B0", "C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1", "C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2", "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3", "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4", "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5", "C6", "C#6", "D6", "D#6", "E6", "F6", "F#6", "G6", "G#6", "A6", "A#6", "B6", "C7", "C#7", "D7", "D#7", "E7", "F7", "F#7", "G7", "G#7", "A7", "A#7", "B7", "C8", "C#8", "D8", "D#8", "E8", "F8", "F#8", "G8", "G#8", "A8", "A#8", "B8"];
var noteDurations = [{string: 'w', math: 1}, {string: 'h', math: 0.5}, {string: 'q', math: 0.25}, {string: '8', math: 0.125}, {string: '16', math: 0.0625}, {string: '32', math: 0.03125}];                             // note lengths base on beats - w=whole note, h=half note,q=quarter note, 8=eighth note, etc
var notes = new Array();
var scoreVoices = new Array();
var sonicScope = new Array();
var originalOutput = [];
var cycles = 0;
var autoCorrection = true;
var noteStarted = false;
var noteEnded = false;
var tempOnset = null;
var tempOffset = null;

//timer & drawer

//default BPM before detection
var BPM = 120; 
var BPS = BPM / 60;
var beatWidth = BPS * 20;
var barWidth = beatWidth * 4;
var initialBarWidth = barWidth;
//pixel speed per second
var PSPS = null; 
//milliseconds pass per pixel
var MSPPP = null;
var dynamicMsDiff = null;
var updatePitchStartTime = null;
var positionInCanvas = barWidth / 4;
var secWidth = BPM / 60 * beatWidth;
var canvasZoom = 1;
var followDrawCondition = true;
var startingTimestamp = null;
//no of snapshots in a Bar
var snapshotsBarDuration = null;
var currentBarNo = 0;//the currect bar we are in time
var noOfUnassignedBars = null;// when we have no tempo we have no bars so this is the number of bars before we have tempo
var unassignedSnapshots = null; //  when we have no tempo we have no bars so this is the number of snapshots before we have tempo
var firstBarsAssigned = false; // if we are ready to have bars
var noOfAssignedNotes = 0; // number of notes that we identify from notes array and pushed it in a voice
var tmpPrevBarEndSnapshot = null;
var vexflowVoices = new Array();
var globalStave = [];

//onsetDetector
var onsetAnalyserBuflen = 2048;
var onsetAnalyserBuffer = new Float32Array(onsetAnalyserBuflen);
var onsetAnalyserTempBuf = new Float32Array(onsetAnalyserBuflen);
var frameStart = 0;
var hammingWindow = null;
var onsets = [];
var sumBPM = 0;
var peaks = null;
var bpmTop = null;
var cycleTempos = [];
var dominantTempo = null;

var onsetDetectorFrameSize = 1024;                                              // for 140 bpm sample must be to 512 to avoid crash
var framesOverlap = 0;
var detectionMethod = ["highFrequencyContent", "phaseDeviation", "euclidianDistance"];
var finalOutput = [];
var normalizedOutput = {firstNormalize: new Float32Array(onsetDetectorFrameSize), lastNormalize: []};
var unNormalizedOutput = [];
var dynamicThresholds = [];
var startProccessingTimestamp = null;
var finalOutputSampleRate = 60; // this is always ~60 because of the requestanimationframe fps
var tmpFinalOutputSamplesLength = null;

//limiter
var limiterLabel = null;
var limiterReduction = null;

//autoCorrelateWorker
var autoCorrelateWorker = new Worker('/js/audio-recognizer/autoCorrelateWorker.js');
var ac = null;
autoCorrelateWorker.onmessage = function (event) {
    ac = event.data;
};
autoCorrelateWorker.onerror = function (event) {
    throw event;
};
//normalizeWorker
var normalizeWorker = new Worker('/js/audio-recognizer/normalizeWorker.js');
normalizeWorker.onmessage = function (event) {
    if (event.data.type === "last") {
        normalizedOutput.lastNormalize = JSON.parse(event.data.array);
    } else if (event.data.type === "first") {
        normalizedOutput.firstNormalize = JSON.parse(event.data.array);
    }
};
normalizeWorker.onerror = function (event) {
    throw event;
};



