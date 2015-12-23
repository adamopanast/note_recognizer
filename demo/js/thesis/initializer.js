'use strict';
initializer = {
    basic: function() {
        drawer.draw();
    },
    settings: {// ++ Parameter Automation in a Dynamic Range Compressor -> https://www.eecs.qmul.ac.uk/~josh/documents/Giannoulis%20Massberg%20Reiss%20-%20dynamic%20range%20compression%20automation%20-%20JAES%202013.pdf
        // ++ Parameter Automation in a Dynamic Range Compressor -> https://www.eecs.qmul.ac.uk/~josh/documents/Giannoulis%20Massberg%20Reiss%20-%20dynamic%20range%20compression%20automation%20-%20JAES%202013.pdf
        instruments: {
            vocals: {
                compressor: {
                    threshold: -8,
                    reduction: 8,
                    knee: 6,
                    ratio: 2,
                    attack: 1,
                    release: 30,
                },
                kind: {                                                         // Base the frequency bandwidth from the table -> http://www.independentrecording.net/irn/resources/freqchart/main_display.htm
                    male: {
                        filter: {                                               // presets to be used on the noisereducer module - ParametricEQ orientation usage // LIKE Noise reducer presets
                            freqs: [100, 900],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    female: {
                        filter: {                                               // presets to be used on the noisereducer module - ParametricEQ orientation usage // LIKE Noise reducer presets
                            freqs: [200, 1200],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                }
            },
            strings: {
                compressor: {
                    threshold: -4,
                    reduction: 4,
                    knee: 6,
                    ratio: 3,
                    attack: 40,
                    release: 80,
                },
                kind: {                                                        
                    bass: {
                        filter: {                                               
                            freqs: [41, 343],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    cello: {
                        filter: {                                             
                            freqs: [56, 520],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    viola: {
                        filter: {                                             
                            freqs: [125, 1000],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    violin: {
                        filter: {                                             
                            freqs: [200, 1300],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    guitar: {
                        filter: {                                             
                            freqs: [82, 1200],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    harp: {
                        filter: {                                             
                            freqs: [29, 3100],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                }
            },
            brass: {
                compressor: {
                    threshold: -8,
                    reduction: 8,
                    knee: 6,
                    ratio: 2.5,
                    attack: 80,
                    release: 250,
                },
                kind: {                                                        
                    tuba: {
                        filter: {                                               
                            freqs: [41, 343],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    frenchHorn: {
                        filter: {                                             
                            freqs: [56, 520],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    bassTrombone: {
                        filter: {                                             
                            freqs: [125, 1000],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    tenorTrombone: {
                        filter: {                                             
                            freqs: [200, 1300],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    trumpet: {
                        filter: {                                             
                            freqs: [82, 1200],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },

                }
            },
            woodwinds: {
                compressor: {
                    threshold: -8,
                    reduction: 8,
                    knee: 6,
                    ratio: 2.5,
                    attack: 80,
                    release: 250,
                },
                kind: {                                                        
                    constraBassoon: {
                        filter: {                                               
                            freqs: [29, 200],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    bassoon: {
                        filter: {                                             
                            freqs: [55, 575],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    tenorSax: {
                        filter: {                                             
                            freqs: [120, 725],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    altoSax: {
                        filter: {                                             
                            freqs: [139, 785],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    clarinet: {
                        filter: {                                             
                            freqs: [139, 1600],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    oboe: {
                        filter: {                                             
                            freqs: [250, 1500],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    flute: {
                        filter: {                                             
                            freqs: [247, 2100],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                    piccolo: {
                        filter: {                                             
                            freqs: [630, 4000],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    },
                }
            },
            piano: {
                compressor: {
                    threshold: -10,
                    reduction: 10,
                    knee: 6,
                    ratio: 6,
                    attack: 40,
                    release: 200,
                },
                kind: {                                                        
                    standard88Key: {
                        filter: {                                               
                            freqs: [27, 4200],
                            types: ["highpass", "lowpass"],
                            Qs: [1, 1]
                        }
                    }
                }
            }
        },
    },
    tools: {
        getMaxOccurrence: function(array) {                                // get the most common value in an array   -- -// ++ send to tools class
            var o = {}, mC = 0, mV, m;
            for (var i = 0, iL = array.length; i < iL; i++) {
                m = array[i];
                o.hasOwnProperty(m) ? ++o[m] : o[m] = 1;
                if (o[m] > mC)
                    mC = o[m], mV = m;
            }
            return mV;
        },
    }
};
Array.prototype.contains = function(needle) {
    for (var i in this) {
        if (this[i] == needle)
            return true;
    }
    return false;
};
Array.prototype.sum = Array.prototype.sum || function() {
    return this.reduce(function(sum, a) {
        return sum + Number(a)
    }, 0);
};
Array.prototype.average = Array.prototype.average || function() {
    return this.sum() / (this.length || 1);
};
// insert of  https://github.com/mikolalysenko/moving-median
function createMedianFilter(length) {
    var buffer = new Float64Array(length)
    var history = new Int32Array(length)
    var counter = 0
    var bufCount = 0
    function insertItem(x) {
        var nextCounter = counter++
        var oldCounter = nextCounter - length

        //First pass:  Remove all old items
        var ptr = 0
        for (var i = 0; i < bufCount; ++i) {
            var c = history[i]
            if (c <= oldCounter) {
                continue
            }
            buffer[ptr] = buffer[i]
            history[ptr] = c
            ptr += 1
        }
        bufCount = ptr

        //Second pass:  Insert x
        if (!isNaN(x)) {
            var ptr = bufCount
            for (var j = bufCount - 1; j >= 0; --j) {
                var y = buffer[j]
                if (y < x) {
                    buffer[ptr] = x
                    history[ptr] = nextCounter
                    break
                }
                buffer[ptr] = y
                history[ptr] = history[j]
                ptr -= 1
            }
            if (j < 0) {
                buffer[0] = x
                history[0] = nextCounter
            }
            bufCount += 1
        }

        //Return median
        if (!bufCount) {
            return NaN
        } else if (bufCount & 1) {
            return buffer[bufCount >>> 1]
        } else {
            var mid = bufCount >>> 1
            return 0.5 * (buffer[mid - 1] + buffer[mid])
        }
    }
    return insertItem
}


                