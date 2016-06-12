

var recLength = 0,
        recBuffersL = [],
        recBuffersR = [];
var sampleRate;

this.onmessage = function (e) {
    switch (e.data.cmd) {
        case 'init' :
            init(e.data.sampleRate);
            break;
        case 'rec' :
            rec(e.data.buffer);
            break;
        case 'editBuffers' :
            editBuffers();
            break;
    }
};

/**
 *  trexei otan er8ei command rec kai kanei push ta L/R Buffers sta 2 global RecBuffers
 *
 *  @param {Float32Array} buffer
 *
 */
function rec(buffer) {
    recBuffersL.push(buffer[0]);
    recBuffersR.push(buffer[1]);
    recLength += buffer[0].length;
};

/**
 *  arxikopoiei ton Worker , orizei ta 2 recBuffers , to sampleRate kai to recLength pou einai 
 *  to mhkos twn buffer ths sunolikhs hxografishs
 *
 * @param {integer} sRate
 *
 */
function init(sRate) {

    recLength = 0;
    recBuffersR = [];
    recBuffersL = [];
    sampleRate = sRate;

};

/**
 *  kanei merge ta buffers kai postarei to final buffer ston recorder
 *
 */
function editBuffers() {
    var finalBuffers = [];
    finalBuffers.push(mergeBuffers(recBuffersL, recLength));
    finalBuffers.push(mergeBuffers(recBuffersR, recLength));
    this.postMessage(finalBuffers);
};

/**
 * kanei merge ta buffers , 3erei auto , to kanei kala kai paizei 
 *
 */
function mergeBuffers(recBuffers, recLength) {
    var result = new Float32Array(recLength);
    var offset = 0;
    for (var i = 0; i < recBuffers.length; i++) {
        result.set(recBuffers[i], offset);
        offset += recBuffers[i].length;
    }
    return result;
};