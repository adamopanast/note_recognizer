'use strict';
actions = {
    sample: {
        playback: function () {
            if (isPlaying) {
                //stop playing and return
                sourceNode.stop(0);
                sourceNode = null;
                isPlaying = false;
                drawer.clearCanvas();
                return "start";
            } else if (isRecording) {
                mediaStreamSource.disconnect(0);
                mediaStreamSource = null;
                isRecording = false;
                drawer.clearCanvas();
            }
            sourceNode.start(0);
            isPlaying = true;
            actions.process();
            return "stop";
        }
    },
    process: function () {
        timer.setStartingTimestamp();
        timer.speedInit();
        actions.thread();
    },
    // unified request animation frame threads
    thread: function () {
        intervalThread = setInterval(function () {
            if (isPlaying === false && isRecording === false)
                clearInterval(intervalThread);
            timer.countOutputSampleRate();
            // to have the value of snapshotsBarDuration
            timer.countBeatDuration(BPM);
            actions.noteVoicesConstruction(cycles);
            //onsetdetector
            try {
                onsetAnalyserNode.getFloatTimeDomainData(onsetAnalyserBuffer);
                onsetDetector.updateOnsets(onsetAnalyserBuffer);
                var onsetDetectorResult = finalOutput[finalOutput.length - 1];
                // add onsetDetector results to a central array
                sumOutput.signal.push(onsetDetectorResult);
            } catch (err) {
            }
            //pitchdetector
            try {
                pitchAnalyserNode.getByteTimeDomainData(pitchAnalyserTempBuf);
                pitchDetector.updatePitch(pitchAnalyserTempBuf);
                var pitchDetectorResult = sonicScope[sonicScope.length - 1];
                // add pitchDetector results to a central array
                sumOutput.is.push(pitchDetectorResult);
            } catch (err) {
            }
            //WORK ON/WITH OUTPUT ARRAY 
            var editableSnapshot = sumOutput.is[sumOutput.is.length - 3]; // set the postprevious snapshot as temp snapshot - two snapshots before to be able to know the next two also when we will correct/characterize    
            if (autoCorrection) {
                var snapshotsNeedForCorrrection = 8;                            // technical delay, for the system to be able to correct before print
            }
            else if (!autoCorrection) {                                          // if the autocorrection is of , there is no need for delay
                var snapshotsNeedForCorrrection = 1;
            }
            var drawableSnapshot = sumOutput.is[sumOutput.is.length - snapshotsNeedForCorrrection];
            var characterizedSnapshot = sumOutput.is[sumOutput.is.length - 25];
            //CHARACTERIZATION
            try {                                                               // Correction of the postprevious Note
                actions.characterization.characterize(editableSnapshot.pointer + 3);
            } catch (err) {
            }
            //CORRECTION
            try {                                                               // Correction of the postprevious Note
                if (autoCorrection && (editableSnapshot instanceof NoteSnapshot)) {
                    editableSnapshot.correctNote(actions.correction.correctPitch(editableSnapshot.pointer + 3));
                }
            } catch (err) {
            }
            //DRAW
            try {
                if (drawableSnapshot instanceof NoteSnapshot) {
                    drawer.renderNotes(drawableSnapshot.note + drawableSnapshot.octave, drawableSnapshot.positionOnCanvas, '#A29292');
                }
            } catch (err) {
            }
            try {
                if (characterizedSnapshot.isOnset) {
                    drawer.drawNotelegend(characterizedSnapshot.note + characterizedSnapshot.octave, characterizedSnapshot.positionOnCanvas);
                }
            } catch (err) {
            }
            if (followDrawCondition) {
                ui.followDraw();
            }
            cycles++;
            // we can have about 20 ms without lot of falling -> 20ms = ~50fps
        }, 20);

    },
    characterization: {
//        Characterization Rules
        characterize: function (arrayPosition) {
            var thisObject = sumOutput.is[arrayPosition - 3];
            var prevObject = sumOutput.is[arrayPosition - 4];
            var prev2Object = sumOutput.is[arrayPosition - 5];
            var nextObject = sumOutput.is[arrayPosition - 2];
            var next2Object = sumOutput.is[arrayPosition - 1];
            var rules = {
                isOnsetCondition: onsets.contains(thisObject.pointer),
                isOffsetCondition: nextObject.amp < 10 && thisObject.amp > nextObject.amp && thisObject.amp > next2Object.amp && prevObject.amp > nextObject.amp && prevObject.amp > next2Object.amp && prev2Object.amp > nextObject.amp && prev2Object.amp > next2Object.amp && prevObject.isOffset === false && prev2Object.isOffset === false && !checkForPrevOffsets(thisObject),
            }
            if (rules.isOnsetCondition) {
                setOnset(thisObject);
            }
            if (rules.isOffsetCondition) {
                setOffset(thisObject);
            }
            // general correction based on onsets and offsets
            if (thisObject.isOffset) {
                var position = thisObject.pointer;
                var snapshotPitches = [];
                var snapshotBPM = [];
                position = thisObject.pointer;
                do {
                    if (sumOutput.is[position] instanceof NoteSnapshot) {
                        snapshotPitches.push(sumOutput.is[position].pitch);
                        snapshotBPM.push(sumOutput.is[position].BPM);
                    }
                    position--;
                }
                while (!sumOutput.is[position].isOnset)
                var mostCommonPitch = initializer.tools.getMaxOccurrence(snapshotPitches);
                var mostCommonBPM = initializer.tools.getMaxOccurrence(snapshotBPM);
                position = thisObject.pointer;
                do {
                    var tempPos = sumOutput.is[position].positionOnCanvas;
                    var tempPointer = sumOutput.is[position].pointer;
                    var tempTimestamp = sumOutput.is[position].timestamp;
                    var tempIsOnset = sumOutput.is[position].isOnset;
                    var tempIsOffset = sumOutput.is[position].isOffset;
                    sumOutput.is[position] = new NoteSnapshot(mostCommonPitch, tempPointer);
                    sumOutput.is[position].positionOnCanvas = tempPos;
                    sumOutput.is[position].timestamp = tempTimestamp;
                    sumOutput.is[position].isOnset = tempIsOnset;
                    sumOutput.is[position].isOffset = tempIsOffset;
                    sumOutput.is[position].BPM = mostCommonBPM;
                    position--;
                }
                while (!sumOutput.is[position].isOnset)
                // to change the onset too which is the last 
                var tempPos = sumOutput.is[position].positionOnCanvas;
                var tempPointer = sumOutput.is[position].pointer;
                var tempTimestamp = sumOutput.is[position].timestamp;
                var tempIsOnset = sumOutput.is[position].isOnset;
                var tempIsOffset = sumOutput.is[position].isOffset;
                sumOutput.is[position] = new NoteSnapshot(mostCommonPitch, tempPointer);
                sumOutput.is[position].positionOnCanvas = tempPos;
                sumOutput.is[position].timestamp = tempTimestamp;
                sumOutput.is[position].isOnset = tempIsOnset;
                sumOutput.is[position].isOffset = tempIsOffset;
                sumOutput.is[position].BPM = mostCommonBPM;
                //create the whole single note from the snapshots
                var note = new SingleNote(tempOnset.pointer, tempOffset.pointer);
                notes.push(note);
            }
            function setOnset(thisObject) {
                sumOutput.is[thisObject.pointer].isOnset = true;
                noteEnded = false;
                noteStarted = true;
                tempOnset = thisObject;
            }
            function setOffset(thisObject) {
                sumOutput.is[thisObject.pointer].isOffset = true;
                tempOffset = thisObject;
                noteEnded = true;
                noteStarted = false;
                silenceNextTwoSnapshots(thisObject.pointer); // with the noteEnded = true; & noteStarted = false; we lose the next two because of the asynchronous way of checking the offsets and pitchdetection

            }
            function silenceNextTwoSnapshots(pointer) {
                var tempPos = sumOutput.is[pointer + 1].positionOnCanvas;
                var tempPointer = sumOutput.is[pointer + 1].pointer;
                var tempTimestamp = sumOutput.is[pointer + 1].timestamp;
                sumOutput.is[pointer + 1] = new SilenceSnapshot(tempPointer);
                sumOutput.is[pointer + 1].timestamp = tempTimestamp;
                sumOutput.is[pointer + 1].positionOnCanvas = tempPos;
                var tempPos = sumOutput.is[pointer + 2].positionOnCanvas;
                var tempPointer = sumOutput.is[pointer + 2].pointer;
                var tempTimestamp = sumOutput.is[pointer + 2].timestamp;
                sumOutput.is[pointer + 2] = new SilenceSnapshot(tempPointer);
                sumOutput.is[pointer + 2].timestamp = tempTimestamp;
                sumOutput.is[pointer + 2].positionOnCanvas = tempPos;
            }
            function checkForPrevOffsets(thisObject) {                           // if until the previous onset does not appear another offset return true
                var position = thisObject.pointer;
                var offsetBefore = false;
                while (!sumOutput.is[position].isOnset) {                       // Go until previous onset
                    position--;
                    if (sumOutput.is[position].isOffset) {                      // if finds another offset this so is fake offset
                        offsetBefore = true;
                        break;
                    }
                }
                return offsetBefore;
            }
        },
    },
    correction: {
        correctPitch: function (arrayPosition) {
            try {
                var lowDiff = 300; // low frequencies differrence in Hz
                var highDiff = 0; // high frequencies differrence in Hz
                var lowThreshold = 100; // lowest threshold in Hz to compare - many times the errors are below this threhold
                var highThreshold = 0; // higest threshold in Hz to compare - many times the errors are above this threhold
                var thisObject = sumOutput.is[arrayPosition - 3];
                var prevObject = sumOutput.is[arrayPosition - 4];
                var prev2Object = sumOutput.is[arrayPosition - 5];
                var nextObject = sumOutput.is[arrayPosition - 2];
                var next2Object = sumOutput.is[arrayPosition - 1];
                var check = function (condition) {                                  // create a function for make the compares to handle them more easily
                    if (condition) {
                        return true;
                    } else {
                        return false;
                    }
                };
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
                    prevnote: (prevObject instanceof NoteSnapshot),
                };
                result[1] = check(errCons.issilencebefore && errCons.nextcomp && errCons.next2comp);
                result[2] = check(errCons.nextpitchdiff);
                result[3] = check(errCons.hasspaceinnote);
                result[4] = check(errCons.prevandnextequal && errCons.prevcomp);
                result[5] = check(errCons.prevcomp && errCons.nextcomp && errCons.prevpitchdiff);
                result[6] = check(errCons.lowthres && errCons.nextcomp && errCons.prevcomp);
                result[7] = check(errCons.isharmonic && errCons.nextcomp);
                result[8] = check(errCons.iserror && errCons.prevnote && !(errCons.issilencebefore));
                if (result.contains(true)) {
                    if (result[3]) {
                        sumOutput.is[arrayPosition - 4].pitch = thisObject.pitch;
                        sumOutput.is[arrayPosition - 4].positionOnCanvas = thisObject.positionOnCanvas - 1;
                        sumOutput.is[arrayPosition - 4].pointer = thisObject.pointer - 1;
                        sumOutput.is[arrayPosition - 4].isOnset = false;
                        sumOutput.is[arrayPosition - 4].timestamp = null;
                    } else if (result[8]) {
                        sumOutput.is[thisObject.pointer] = sumOutput.is[arrayPosition - 4];
                        sumOutput.is[thisObject.pointer].positionOnCanvas = thisObject.positionOnCanvas - 1;
                        sumOutput.is[thisObject.pointer].pointer = thisObject.pointer - 1;
                        sumOutput.is[thisObject.pointer].isOnset = false;
                        sumOutput.is[thisObject.pointer].timestamp = null;
                    }
                    else {
                        return nextObject.pitch;
                    }
                } else {
                    return thisObject.pitch; // the pitch is equal to the next n and prev n so we return it untouched
                }

            } catch (err) {
            }
            function previousAreSilence(arrayPosition) {                         // function to scan previous objects and see if all of a specified (random at the moment) are silence - used in correctPitches conditions
                var i = 4;
                var isSilence;
                for (i = 4; i < 60; i++) {
                    if ((sumOutput.is[arrayPosition - i] instanceof SilenceSnapshot)) { //check if i is silence
                        isSilence = true;
                    } else {
                        isSilence = false;
                        break;
                    }
                }
                return isSilence;
            }

        }
    },
    noteVoicesConstruction: function (cycles) {
        if (!(isNaN(snapshotsBarDuration) || snapshotsBarDuration === 0)) {     // if we can determine the bar length
            if (firstBarsAssigned) {
                if (cycles === parseInt(snapshotsBarDuration * currentBarNo + unassignedSnapshots) - 1) {     //we are on the end of the active bar
                    if (unassignedSnapshots === 0) {
                        var startSnapshot = tmpPrevBarEndSnapshot + 1;          //var startSnapshot = cycles - snapshotsBarDuration + 1;// we could use a tmp snapshotsBarDuration from the previous bar bpm to avoid the gap between bars on bpm change
                        var endSnapshot = cycles;
                        tmpPrevBarEndSnapshot = endSnapshot;                    // because if the snapshotsBarDuration changes when bpm change it will generate a gap between the previous and current bar because of the difference
                        scoreVoices[currentBarNo - 1] = new NotesVoice(parseInt(startSnapshot), parseInt(endSnapshot), null, currentBarNo);
                    }
                    else if (unassignedSnapshots > 0) {
                        var startSnapshot = cycles - snapshotsBarDuration - parseInt(unassignedSnapshots) + 1;
                        var endSnapshot = cycles - parseInt(unassignedSnapshots) - 1;
                        tmpPrevBarEndSnapshot = endSnapshot;
                        scoreVoices[currentBarNo - 1] = new NotesVoice(parseInt(startSnapshot), parseInt(endSnapshot), null, currentBarNo);
                        unassignedSnapshots = 0;
                    }
                    currentBarNo++;
                }
            }
            else if (!firstBarsAssigned) {                                      // execute only on the first cycle when we have bar length
                var bars = cycles / snapshotsBarDuration;
                unassignedSnapshots = (cycles / snapshotsBarDuration - parseInt(cycles / snapshotsBarDuration)) * snapshotsBarDuration;
                noOfUnassignedBars = bars - unassignedSnapshots / snapshotsBarDuration;
                for (var bar = 0; bar <= noOfUnassignedBars; bar++) {           // create notevoice objects
                    var startSnapshot = bar * snapshotsBarDuration;
                    var endSnapshot = bar * snapshotsBarDuration + snapshotsBarDuration - 1;
                    scoreVoices[bar] = new NotesVoice(parseInt(startSnapshot), parseInt(endSnapshot), null, bar);
                }
                firstBarsAssigned = true;
                currentBarNo = noOfUnassignedBars + 1;                          // we assign the next bar from this as active
            }
        } else {
            unassignedSnapshots++;                                              // this runs until we can determine the bar length
        }

    },
    // Sets the EQ preset
    setEQPreset: function (preset) {
        if (preset.freqs)
            instrumentEQNodes.setBandFrequencies(preset.freqs);
        if (preset.types)
            instrumentEQNodes.setBandTypes(preset.types);
        if (preset.Qs)
            instrumentEQNodes.setQValues(preset.Qs);
        if (preset.gains)
            instrumentEQNodes.setBandGains(preset.gains);
    },
    limiter: {//http://codepen.io/andremichelle/pen/WbqrYN/
        dbToGain: function (db) {
            return Math.exp(db * Math.log(10.0) / 20.0);
        },
        maximize: function (db) {
            preGainNode.gain.value = actions.limiter.dbToGain(db);
            limiterLabel.textContent = db;
        },
    },
}