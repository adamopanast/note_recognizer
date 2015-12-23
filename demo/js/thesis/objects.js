
//note snapshots
function NoteSnapshot(pitch, notePointer) {
    this.pointer = notePointer;
    this.pitch = pitch;
    try {
        this.note = noteStrings[this.noteFromPitch(this.pitch) % 96].match(/[A-G+#]/gi).join('');
    } catch (err) {
    }
    this.detune = this.centsOffFromPitch(this.pitch, this.noteFromPitch(this.pitch));
    this.timestamp = this.setTimestamp();
    this.bpm = BPM;
    try {
        this.octave = noteStrings[this.noteFromPitch(this.pitch) % 96].match(/[0-9]+/g).map(function (n)
        {//just coerce to numbers
            return +(n);
        })[0];
    } catch (err) {
    }
    this.positionOnCanvas = positionInCanvas;
    this.isOnset = false;
    // the amplitude after the onset detection function
    this.amp = sumOutput.signal[this.pointer];                                  
    this.isOffset = false;                                                      
}
NoteSnapshot.prototype.noteFromPitch = function (frequency) {                   
    var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 45; // for 8 octaves
}
NoteSnapshot.prototype.centsOffFromPitch = function (frequency, note) {
    return Math.floor(1200 * Math.log(frequency / pitchDetector.frequencyFromNoteNumber(note)) / Math.log(2));
}
NoteSnapshot.prototype.correctNote = function (pitch) {
    this.pitch = pitch;
    try {
        this.note = noteStrings[this.noteFromPitch(this.pitch) % 96].match(/[A-G+#]/gi).join('');
    } catch (err) {
    }
    this.detune = this.centsOffFromPitch(this.pitch, this.noteFromPitch(this.pitch));
    try {
        this.octave = noteStrings[this.noteFromPitch(this.pitch) % 96].match(/[0-9]+/g).map(function (n)
        {
            //just coerce to numbers
            return +(n);
        })[0];
    } catch (err) {
    }
}
NoteSnapshot.prototype.setTimestamp = function () {
    return  Date.now() - startingTimestamp;
};
//single note - this is produced of note snapshots in row
function SingleNote(noteStartPointer, noteEndPointer) {
    this.snapshots = this.includeSnapshots(noteStartPointer, noteEndPointer);
    this.onsetSnapshot = noteStartPointer;
    this.note = this.snapshots[0].note;
    this.octave = this.snapshots[0].octave;
    this.bpm = this.snapshots[0].bpm;
    //the system maybe override these on voice construction //
    this.duration = this.calculateDuration(this.snapshots.length, this.bpm);    
    this.staveNote = this.createVexflowNote(this.note, this.octave, this.duration);
}
SingleNote.prototype.includeSnapshots = function (noteStartPointer, noteEndPointer) {
    var snapshotsArray = [];
    for (var i = noteStartPointer; i <= noteEndPointer; i++) {
        snapshotsArray.push(sumOutput.is[i]);
    }
    return  snapshotsArray;
};
SingleNote.prototype.calculateDuration = function (lengthInSnapshots, bpm) {
    snapshotsPerBeat = timer.countBeatDuration(bpm);                             
    var divisionCount = snapshotsPerBeat / lengthInSnapshots;
    if (divisionCount <= 1.20)
        return noteDurations[0];      
    // whole note
    else if (divisionCount > 1.20 && divisionCount <= 3)
        return noteDurations[1];   
    // half note
    else if (divisionCount > 3 && divisionCount <= 5)
        return noteDurations[2];
    else if (divisionCount > 5 && divisionCount <= 11)
        return noteDurations[3];
    else if (divisionCount > 11 && divisionCount <= 24)
        return noteDurations[4];
    else if (divisionCount > 24)
        return noteDurations[5];
    var tmpDifferences = [];
    for (var k = 0; k < noteDurations.length; k++) {
        // find the differences - the min diff is the index we need
        tmpDifferences[k] = Math.abs(durationOfDividedRests - noteDurations[k].math); 
    }
};
SingleNote.prototype.createVexflowNote = function (note, octave, duration) {
    var vexflowNote = new Vex.Flow.StaveNote({keys: [note.toLowerCase() + '/' + octave.toString()], duration: duration.string});
    if (note.substr(1, 1) === '#') {      
        // create sharp notes - it needs to be in different way
        vexflowNote.addAccidental(0, new Vex.Flow.Accidental("#"));
    }
    return vexflowNote;
};
// score voice - voice of singlenotes
// we need a project oriented object of voice to handle it carefully with the vexflow voice object
function NotesVoice(startSnapshot, endSnapshot, notesArray, noOfVoice) {                                    
    this.startSnapshot = startSnapshot;
    this.endSnapshot = endSnapshot;
    this.voiceDuration = this.endSnapshot - this.startSnapshot;
    this.noOfVoice = noOfVoice;
    this.notes = notesArray;
    if (notesArray === null) {
        // scan the notes array to find notes that are betwwen the voice's limits
        this.notes = this.pushNotes(this.startSnapshot, this.endSnapshot);       
    }
    this.staveNotes = this.returnVexflowNotes(this.notes, this.startSnapshot, this.endSnapshot, this.voiceDuration, this.noOfVoice);
}
NotesVoice.prototype.pushNotes = function (startSnapshot, endSnapshot) {
    var notesOfVoice = new Array();
    for (var j = 0; j < notes.length; j++) {
        if (notes[j].onsetSnapshot > startSnapshot && notes[j].onsetSnapshot < endSnapshot) {
            notesOfVoice.push(notes[j]);
        }
    }
    return notesOfVoice;
};
NotesVoice.prototype.returnVexflowNotes = function (notesArray, startSnapshot, endSnapshot, voiceDuration, noOfVoice) {
    var vexflowNotesArray = [];
    var voiceDurationMetered = 0;
    var currentSubBarDuration = 0;
    var restDurationUnmetered = null;
    var restDurationMetered = null;
    var vexPosition = 0;
    for (var i = 0; i < notesArray.length; i++) {                               
        var calculatedNoteDuration = 1 / (voiceDuration / notesArray[i].snapshots.length);
        var tmpDifferences = [];
        for (var k = 0; k < noteDurations.length; k++) {
            // find the differences - the min diff is the index we need
            tmpDifferences[k] = Math.abs(calculatedNoteDuration - noteDurations[k].math); 
        }
        notesArray[i].duration = noteDurations[tmpDifferences.indexOf(Math.min.apply(Math, tmpDifferences))];
        notesArray[i].staveNote.duration = notesArray[i].duration.string;
        restDurationMetered = 0;
        // check if the note in the voice is a whole
        if (notesArray[i].duration.math === 1) {             
            // if it is a whole just add this note to the stave notes array of the voice
            vexflowNotesArray[vexPosition] = notesArray[i].staveNote;               
            // if it is smaller than whole and and it starts on the startSnapshot
        } else if (notesArray[i].duration.math < 1 && i === 0 && notesArray[i].onsetSnapshot === startSnapshot) { 
            // add the note to the beginning of the array
            vexflowNotesArray[vexPosition] = notesArray[i].staveNote;              
            // if it is smaller than whole and it has rest before it
        } else if (notesArray[i].duration.math < 1 && i === 0 && notesArray[i].onsetSnapshot > startSnapshot) { 
             // we find the end of the current note in snapshots and we substract from this the startsnapshot to find the duration of the bar until now
            currentSubBarDuration = (notesArray[i].onsetSnapshot + notesArray[i].snapshots.length - 1) - startSnapshot;
            // we find the rest length until now
            var restSnapshotDuration = currentSubBarDuration - notesArray[i].snapshots.length; 
            restDurationUnmetered = restSnapshotDuration / voiceDuration;     
            // find the restDuration according the noteDurations meter (maybe not one of this meter valus exactly)
            voiceDurationMetered = currentSubBarDuration / voiceDuration;
        }
        else if (notesArray[i].duration.math < 1 && i > 0) {
            var lastSubBarDuration = currentSubBarDuration;
            currentSubBarDuration = (notesArray[i].onsetSnapshot + notesArray[i].snapshots.length - 1) - startSnapshot;
            var restSnapshotDuration = currentSubBarDuration - lastSubBarDuration - notesArray[i].snapshots.length;
            restDurationUnmetered = restSnapshotDuration / voiceDuration;
            voiceDurationMetered = currentSubBarDuration / voiceDuration;
        }
         // if the rest is smaller than 1/32 skip it
        if (restDurationUnmetered < noteDurations[5].math) {                   
            vexflowNotesArray[vexPosition] = notesArray[i].staveNote;
        } else {
            var meteredRest = meterRest(restDurationUnmetered);
            restDurationMetered = meteredRest.math;
            var restDurationMeteredString = meteredRest.string;
            // add a rest note to the appropriate position
            vexflowNotesArray[vexPosition] = new Vex.Flow.StaveNote({keys: ["b/4"], duration: restDurationMeteredString}); 
            vexflowNotesArray[vexPosition + 1] = notesArray[i].staveNote;
            vexPosition++;
        }
        var voiceDurationMeteredAfter = 0;
        for (var h = 0; h < vexflowNotesArray.length; h++) {
            var noteDurationString = vexflowNotesArray[h].duration;
            for (var p = 0; p < noteDurations.length; p++) {
                if (noteDurations[p].string === noteDurationString)
                    voiceDurationMeteredAfter = voiceDurationMeteredAfter + noteDurations[p].math;
            }
        }
        var sum = 0;
        $(vexflowNotesArray).each(function () {
            sum = sum + this.intrinsicTicks;
        });
        vexPosition++;
    }
    if (notesArray.length === 0) {                       
        // if the bar has no notes we will complete it with a whole rest
        vexflowNotesArray[0] = new Vex.Flow.StaveNote({keys: ["b/4"], duration: 'wr'});
    }
    var tmp = 0;
    for (var h = 0; h < vexflowNotesArray.length; h++) {
        var noteDurationString = vexflowNotesArray[h].duration;
        for (var p = 0; p < noteDurations.length; p++) {
            if (noteDurations[p].string === noteDurationString)
                tmp = tmp + noteDurations[p].math;
        }
    }
    vexflowVoices[noOfVoice] = new Vex.Flow.Voice({
        num_beats: 4,
        beat_value: 4,
        resolution: Vex.Flow.RESOLUTION
    });
     // THIS IS IMPORTANT TO BE ABLE TO ADD TICKABLES WITHOUT RESTRICTIONS
    vexflowVoices[noOfVoice].setMode(2);                                                   
    vexflowVoices[noOfVoice].addTickables(vexflowNotesArray);
    vexflowVoices[noOfVoice].addTickables(vexflowNotesArray);
    // Format and justify the notes to 300 pixels
    var formatter = new Vex.Flow.Formatter().format([vexflowVoices[noOfVoice]], globalStave[noOfVoice].width);
    // Render voice
    vexflowVoices[noOfVoice].draw(scoreContext, globalStave[noOfVoice], {align_rests: false});

    return vexflowNotesArray;

    function meterRest(restDurationUnmetered) {
        var tmpDifferences = [];
        for (var j = 0; j < noteDurations.length; j++) {
            // find the differences - the min diff is the index we need
            tmpDifferences[j] = Math.abs(restDurationUnmetered - noteDurations[j].math); 
        }
        var restDurationMetered = noteDurations[tmpDifferences.indexOf(Math.min.apply(Math, tmpDifferences))].math;
        var restDurationMeteredString = noteDurations[tmpDifferences.indexOf(Math.min.apply(Math, tmpDifferences))].string + 'r';
        return {math: restDurationMetered, string: restDurationMeteredString};
    }
};
//silence
function SilenceSnapshot(silencePointer) {
    this.pointer = silencePointer;
    this.timestamp = this.setTimestamp();
    this.positionOnCanvas = positionInCanvas;
    // this is the amplitude after the onset detection function
    this.amp = sumOutput.signal[this.pointer];                                  
}
SilenceSnapshot.prototype.setTimestamp = function () {
    return  Date.now() - startingTimestamp;
};
function ErrorSnapshot(errorPointer) {
    this.pointer = errorPointer;
    this.timestamp = this.setTimestamp();
    this.positionOnCanvas = positionInCanvas;
    // this is the amplitude after the onset detection function
    this.amp = sumOutput.signal[this.pointer];                                  
    this.isOnset = false;
}
ErrorSnapshot.prototype.setTimestamp = function () {
    return  Date.now() - startingTimestamp;
};
