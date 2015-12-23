'use strict';

drawer = {
    draw: function (BPM) {
        drawer.drawPianoRollNotes();
        drawer.drawPianoRollBars();
        drawer.drawPianoRollBeats();
        drawer.drawTime();

    },
    BPMrefresh: function () {
        pianoRollContext.clearRect(0, 0, pianoRollCanvas.width, pianoRollCanvas.height); // - to be applied only on the background canvases
        BPS = BPM / 60;
        beatWidth = BPS * 20; //??? is it right?
        barWidth = beatWidth * 4;
        drawer.draw();
        // i use the redrawNotesCorrected loop for redraw the notes
        for (var i = 0; i < sumOutput.is.length; i++) {
            drawer.renderNotes(sumOutput.is[i].note + sumOutput.is[i].octave, sumOutput.is[i].positionOnCanvas, '#82A28B');
        }
    },
    redrawNotesCorrected: function () {                                         // draw all notes together after characterization corrected
        pianoRollContext.clearRect(0, 0, pianoRollCanvas.width, pianoRollCanvas.height);
        drawer.draw();
        for (var i = 0; i < sumOutput.is.length; i++) {
            drawer.renderNotes(sumOutput.is[i].note + sumOutput.is[i].octave, sumOutput.is[i].positionOnCanvas, '#82A28B');
        }
    },
    clearCanvas: function () {
        pianoRollContext.clearRect(0, 0, pianoRollCanvas.width, pianoRollCanvas.height);
        drawer.draw(BPM);
        if (isPlaying) {
            //stop playing and return
            sourceNode.stop(0);
            sourceNode = null;
            isPlaying = false;
            if (!window.cancelAnimationFrame)
                window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
            window.cancelAnimationFrame(rafID);
            return "start";
        } else if (isRecording) {
            mediaStreamSource.disconnect(0);
            mediaStreamSource = null;
            isRecording = false;
        }
        positionInCanvas = 80;
        sumOutput = {signal: new Array(), is: new Array()};
    },
    drawPianoRollNotes: function () {
        pianoRollContext.fillStyle = "#a29292";
        pianoRollContext.font = "10px Arial";
        var pianoRollNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        var position = 980;
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 12; j++) {
                pianoRollContext.fillText(pianoRollNotes[j] + i, 0, position);
                position -= 10;
            }
        }
        for (var i = 20; i < 990; i = i + 10) {
            pianoRollContext.lineWidth = 0.5;
            pianoRollContext.strokeStyle = '#efefef';
            pianoRollContext.beginPath();
            pianoRollContext.moveTo(0, i);
            pianoRollContext.lineTo(pianoRollCanvas.width, i);
            pianoRollContext.stroke();
        }
    },
    drawPianoRollBars: function () {
        pianoRollContext.fillStyle = "#a29292";
        pianoRollContext.font = "10px Arial";
        pianoRollContext.lineWidth = 1;
        pianoRollContext.strokeStyle = '#D5D5D5';
        var initialMargin = 40;
        for (var i = barWidth; i < pianoRollCanvas.width; i = i + barWidth) {
            if (i > barWidth) {
                pianoRollContext.fillText(Math.round(i / barWidth), i - barWidth + initialMargin, 10);
                pianoRollContext.beginPath();
                pianoRollContext.moveTo(i - barWidth + initialMargin, 16);
                pianoRollContext.lineTo(i - barWidth + initialMargin, pianoRollCanvas.height - 18);
            } else {
                pianoRollContext.fillText(i / barWidth, initialMargin, 10);
                pianoRollContext.beginPath();
                pianoRollContext.moveTo(initialMargin, 16);
                pianoRollContext.lineTo(initialMargin, pianoRollCanvas.height - 18);
            }
            pianoRollContext.stroke();
        }
    },
    drawPianoRollBeats: function () {
        pianoRollContext.lineWidth = 1;
        pianoRollContext.strokeStyle = '#efefef';
        var initialMargin = 40;
        for (var i = initialMargin; i < pianoRollCanvas.width; i = i + beatWidth) {
            pianoRollContext.beginPath();
            if (i > initialMargin) {
                pianoRollContext.moveTo(i, 16);
                pianoRollContext.lineTo(i, pianoRollCanvas.height - 18);
            } else {
                pianoRollContext.moveTo(initialMargin, 16);
                pianoRollContext.lineTo(initialMargin, pianoRollCanvas.height - 18);
            }
            pianoRollContext.stroke();
        }
    },
    drawTime: function () {
        pianoRollContext.fillStyle = "#a29292";
        pianoRollContext.font = "10px Arial";
        pianoRollContext.lineWidth = 1;
        pianoRollContext.strokeStyle = '#D5D5D5';
        var initialMargin = 40;
        // the width of 1 second in pianoroll
        secWidth = BPM / 60 * beatWidth || 120 / 60 * beatWidth;                                
        var seconds = 0.00;
        var minutes = 0.00;
        for (var i = 0; i < pianoRollCanvas.width; i = i + secWidth) {
            if (seconds + minutes > minutes + 0.60) {
                minutes += 1.00;
                seconds = 0.00;
            }
            if (i === 0) {
                pianoRollContext.fillText((parseFloat(minutes) + parseFloat(seconds)).toFixed(2), i + initialMargin, 1000);
                pianoRollContext.beginPath();
                pianoRollContext.moveTo(i + initialMargin, 982);
                pianoRollContext.lineTo(i + initialMargin, 990);
            } else {
                pianoRollContext.fillText((parseFloat(minutes) + parseFloat(seconds)).toFixed(2), i + initialMargin - i / barWidth, 1000);
                pianoRollContext.beginPath();
                pianoRollContext.moveTo(i + initialMargin - i / barWidth, 982);
                pianoRollContext.lineTo(i + initialMargin - i / barWidth, 990);
            }
            pianoRollContext.stroke();
            seconds += 0.01;
        }
    },
    renderNotes: function (note, positionOnCanvas, color) {
        pianoRollContext.beginPath();
        pianoRollContext.strokeStyle = color;
        var height = drawer.returnNoteHeight(note);
        pianoRollContext.rect(positionOnCanvas, height + 3, 1, 7);
        pianoRollContext.stroke();
    },
    returnNoteHeight: function (note) {
        var height = pianoRollCanvas.height;
        switch (note) {
            case "C0":
                height = height - 20;
                break;
            case "C#0":
                height = height - 30;
                break;
            case "D0":
                height = height - 40;
                break;
            case "D#0":
                height = height - 50;
                break;
            case "E0":
                height = height - 60;
                break;
            case "F0":
                height = height - 70;
                break;
            case "F#0":
                height = height - 80;
                break;
            case "G0":
                height = height - 90;
                break;
            case "G#0":
                height = height - 100;
                break;
            case "A0":
                height = height - 110;
                break;
            case "A#0":
                height = height - 120;
                break;
            case "B0":
                height = height - 130;
                break;
            case "C1":
                height = height - 140;
                break;
            case "C#1":
                height = height - 150;
                break;
            case "D1":
                height = height - 160;
                break;
            case "D#1":
                height = height - 170;
                break;
            case "E1":
                height = height - 180;
                break;
            case "F1":
                height = height - 190;
                break;
            case "F#1":
                height = height - 200;
                break;
            case "G1":
                height = height - 210;
                break;
            case "G#1":
                height = height - 220;
                break;
            case "A1":
                height = height - 230;
                break;
            case "A#1":
                height = height - 240;
                break;
            case "B1":
                height = height - 250;
                break;
            case "C2":
                height = height - 260;
                break;
            case "C#2":
                height = height - 270;
                break;
            case "D2":
                height = height - 280;
                break;
            case "D#2":
                height = height - 290;
                break;
            case "E2":
                height = height - 300;
                break;
            case "F2":
                height = height - 310;
                break;
            case "F#2":
                height = height - 320;
                break;
            case "G2":
                height = height - 340;
                break;
            case "G#2":
                height = height - 350;
                break;
            case "A2":
                height = height - 360;
                break;
            case "A#2":
                height = height - 370;
                break;
            case "B2":
                height = height - 380;
                break;
            case "C3":
                height = height - 390;
                break;
            case "C#3":
                height = height - 400;
                break;
            case "D3":
                height = height - 410;
                break;
            case "D#3":
                height = height - 420;
                break;
            case "E3":
                height = height - 430;
                break;
            case "F3":
                height = height - 440;
                break;
            case "F#3":
                height = height - 450;
                break;
            case "G3":
                height = height - 460;
                break;
            case "G#3":
                height = height - 470;
                break;
            case "A3":
                height = height - 480;
                break;
            case "A#3":
                height = height - 490;
                break;
            case "B3":
                height = height - 500;
                break;
            case "C4":
                height = height - 510;
                break;
            case "C#4":
                height = height - 520;
                break;
            case "D4":
                height = height - 530;
                break;
            case "D#4":
                height = height - 540;
                break;
            case "E4":
                height = height - 550;
                break;
            case "F4":
                height = height - 560;
                break;
            case "F#4":
                height = height - 570;
                break;
            case "G4":
                height = height - 580;
                break;
            case "G#4":
                height = height - 590;
                break;
            case "A4":
                height = height - 600;
                break;
            case "A#4":
                height = height - 610;
                break;
            case "B4":
                height = height - 620;
                break;
            case "C5":
                height = height - 630;
                break;
            case "C#5":
                height = height - 640;
                break;
            case "D5":
                height = height - 650;
                break;
            case "D#5":
                height = height - 660;
                break;
            case "E5":
                height = height - 670;
                break;
            case "F5":
                height = height - 680;
                break;
            case "F#5":
                height = height - 690;
                break;
            case "G5":
                height = height - 700;
                break;
            case "G#5":
                height = height - 710;
                break;
            case "A5":
                height = height - 720;
                break;
            case "A#5":
                height = height - 730;
                break;
            case "B5":
                height = height - 740;
                break;
            case "C6":
                height = height - 750;
                break;
            case "C#6":
                height = height - 760;
                break;
            case "D6":
                height = height - 770;
                break;
            case "D#6":
                height = height - 780;
                break;
            case "E6":
                height = height - 790;
                break;
            case "F6":
                height = height - 800;
                break;
            case "F#6":
                height = height - 810;
                break;
            case "G6":
                height = height - 820;
                break;
            case "G#6":
                height = height - 830;
                break;
            case "A6":
                height = height - 840;
                break;
            case "A#6":
                height = height - 850;
                break;
            case "B6":
                height = height - 860;
                break;
            case "C7":
                height = height - 870;
                break;
            case "C#7":
                height = height - 880;
                break;
            case "D7":
                height = height - 890;
                break;
            case "D#7":
                height = height - 900;
                break;
            case "E7":
                height = height - 910;
                break;
            case "F7":
                height = height - 920;
                break;
            case "F#7":
                height = height - 930;
                break;
            case "G7":
                height = height - 940;
                break;
            case "G#7":
                height = height - 950;
                break;
            case "A7":
                height = height - 960;
                break;
            case "A#7":
                height = height - 970;
                break;
            case "B7":
                height = height - 980;
                break;
        }
        return height;
    },
    drawNotelegend: function (note, positionOnCanvas) {
        var height = drawer.returnNoteHeight(note, positionOnCanvas);
        pianoRollContext.color = "#AFAFAF";
        pianoRollContext.font = "6px Arial";
        pianoRollContext.fillText(note, positionOnCanvas+3, height + 9);
    },
    drawStaves: function (currentVoice) {
        if (!currentVoice) {                                                    // check if it is the first time its called , if is not means that the staves are gone and we need more
            var curStave = 0;
        }
        var staveWidth = window.innerWidth / 4;
        var staveLines = 16;
        var staveHeight = scoreCanvas.height / staveLines;
        var stavesNo = (window.innerWidth / staveWidth) * staveLines;
        for (var i = 0; i < staveLines; i++) {
            for (var y = 0; y < stavesNo / staveLines; y++) {
                globalStave[curStave] = new Vex.Flow.Stave(y * staveWidth, i * staveHeight, staveWidth);
                globalStave[curStave].setContext(scoreContext).draw();
                //We pass the context to the stave and call draw, which renders the stave on the context. - Notice that the stave is not exactly drawn in position 0, 0. This is because it reserves some head-room for higher notes.
                if (y === 0)
                    globalStave[curStave].addClef("treble").setContext(scoreContext).draw();
                curStave++;
            }
        }
    }
};

