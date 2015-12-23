'use strict';

timer = {
    speedInit: function () {
        BPS = BPM / 60;                                                       
        //pixel speed per second
        PSPS = BPS * beatWidth; 
        // for example in 120 bpm it moves 1 pixel every 25ms
        //milliseconds pass per pixel  
        MSPPP = 1 / (PSPS / 1000);               
        // dynamic millisecond difference
        dynamicMsDiff = MSPPP / 1000;                                           
        updatePitchStartTime = audioContext.currentTime;
    },
    // this is to disallow change pixel faster than MSPPP
    cursorSpeed: function (frameStartTime) {
        if (frameStartTime - updatePitchStartTime >= dynamicMsDiff) {           
            dynamicMsDiff = dynamicMsDiff + MSPPP / 1000;
            positionInCanvas++;
            return true;
        } else {
            return false;
        }
    },
    // this maybe varies because the setInterval has not a standard fps
    countOutputSampleRate: function () { 
        if (Date.now() - startProccessingTimestamp >= 1000) {
            finalOutputSampleRate = sumOutput.signal.length - tmpFinalOutputSamplesLength;
            startProccessingTimestamp = Date.now();
            tmpFinalOutputSamplesLength = sumOutput.signal.length;
            // here we can count the most common finalOutputSampleRate each time (in compare with the previous ones) and use this
        }
    },
    countBeatDuration: function (bpm) {
        // multiply fps with seconds of a minute to find sanpshots per minute 
        // (every SingleNote has a certain amount of snapshots so we can determine its beat division)
        var minuteSnapshots = finalOutputSampleRate * 60;   
        // how many snapshots is a beat
        var snapshotsPerBeat = minuteSnapshots / bpm;                              
        snapshotsBarDuration = snapshotsPerBeat * 4;                            
        return snapshotsPerBeat;
    },    
    setStartingTimestamp: function () {
        startingTimestamp = null;
        startingTimestamp = Date.now();
    }
};
