'use strict';

function normalize(signal) {
    var maxValue = signal.reduce(function (max, item) {
        return Math.max(Math.abs(max), Math.abs(item));
    });

    var m = Math.max(Math.abs(maxValue));
    for (var j = 0; j < signal.length; j++)
        signal[j] = 1000 / m * signal[j];
    return signal;
}
self.addEventListener('message', function (e) {
    if (e.data.type === "last")
        self.postMessage({array: JSON.stringify(normalize(JSON.parse(e.data.array))), type: e.data.type});
    else if(e.data.type === "first")
        self.postMessage({array: JSON.stringify(normalize(JSON.parse(e.data.array))), type: e.data.type});
    
}, false);

