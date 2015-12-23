'use strict';
pitchDetector = {
    frequencyFromNoteNumber: function (note) {
        return 440 * Math.pow(2, (note - 45) / 12); // for 8 octaves
    },
    updatePitch: function (signal) {  //5
        if (timer.cursorSpeed(audioContext.currentTime)) {                      
            try {
                autoCorrelateWorker.postMessage({array: signal, samples: audioContext.sampleRate});
            } catch (err) {
            }
            // This is the silence which autocorrelation understands
            // noteEnded is asynchronous so it lose the two snapshots after the offset 
            // ( i use for this -> actions.correction.subroutines.silenceNextTwoSnapshots)
            if (ac === -1 || noteEnded) {     
                // create silcence object instance
                var silence = new SilenceSnapshot(sonicScope.length);           
                sonicScope.push(silence);
                detectorElem.className = "vague";
                $("#pitch").text("--");
                pitchElem.innerText = "--";
                detuneElem.className = "";
                detuneAmount.innerText = "--";
            } else if (ac === 11025) {
                // create silcence object instance
                var error = new ErrorSnapshot(sonicScope.length);           
                sonicScope.push(error);
                detectorElem.className = "vague";
                $("#pitch").text("--");
                detuneElem.className = "";
                detuneAmount.innerText = "--";
            }
            // this condition applied only when autocorrelation understands a note
            else {                                                            
                detectorElem.className = "confident";
                pitch = ac;
                $("#pitch").text(Math.floor(pitch));
                // create note object instance
                var note = new NoteSnapshot(pitch, sonicScope.length);  
                // this is a fulltime array which stores anything happens (silence or note)
                sonicScope.push(note);                                          
                noteElem.innerHTML = note.note + note.octave;

                if (note.detune == 0) {
                    detuneElem.className = "";
                    detuneAmount.innerHTML = "--";
                } else {
                    if (note.detune < 0)
                        detuneElem.className = "flat";
                    else
                        detuneElem.className = "sharp";
                    detuneAmount.innerHTML = Math.abs(note.detune);
                }
            }
        }
      
    },
};


                