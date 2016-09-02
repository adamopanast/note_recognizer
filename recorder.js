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
}
;

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

}
;

/**
 *  kanei merge ta buffers kai postarei to final buffer ston recorder
 *
 */
function editBuffers() {
    var finalBuffers = [];
    finalBuffers.push(mergeBuffers(recBuffersL, recLength));
    finalBuffers.push(mergeBuffers(recBuffersR, recLength));
    this.postMessage(finalBuffers);
}
;

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
}
;