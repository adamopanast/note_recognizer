$(function () {
    $("#mic-button").click(function () {
        $("#sample-button").attr("disabled", "disabled").off('click');
        $("#sample-button").children().attr("disabled", "disabled").off('click');
        $("#sample-button").addClass("disabled");
        $("#mic-button").removeClass("disabled");
        $("#sample-button").removeClass("enabled");
        $("#mic-button").addClass("enabled");
    });
    $("#sample-button").click(function () {
        $("#mic-button").attr("disabled", "disabled").off('click');
        $("#mic-button").children().attr("disabled", "disabled").off('click');
        $("#sample-button").removeAttr('disabled');
        $("#mic-button").addClass("disabled");
        $("#sample-button").removeClass("disabled");
        $("#mic-button").removeClass("enabled");
        $("#sample-button").addClass("enabled");
    });
    $("#follow-button").click(function () {
        if (!followDrawCondition) {
            ui.followDraw();
            followDrawCondition = true;
            $(this).addClass("active");
            $(this).removeClass("inactive");
        } else if (followDrawCondition) {
            followDrawCondition = false;
            $(this).removeClass("active");
            $(this).addClass("inactive");
        }
    });
    $("#autocorrection-button").click(function () {
        if (!autoCorrection) {
            autoCorrection = true;
            $(this).addClass("active");
            $(this).removeClass("inactive");
        } else if (autoCorrection) {
            autoCorrection = false;
            $(this).removeClass("active");
            $(this).addClass("inactive");
        }
    });
    $("#bpm-indicator > kbd").text(BPM + " BPM");
    $(document).ready(function () { //make scroll of canvas available on top too
        $('.output #pianoRoll > div').doubleScroll();
        $('.output #score > div').doubleScroll();
    });
    $(function () {
        $("#output-tabs").tabs();
        document.getElementById("sample-button").addEventListener("change", ui.onFileChosen);
    });
    ui = {
        followDraw: function () {
            $('#pianoRoll > div').scrollLeft(positionInCanvas - (window.innerWidth / 1.5));
        },
        // Creates a buffer from a file, callback is a function of the newly created buffer
        bufferFromFile: function (file, callback) {
            var reader = new FileReader();
            reader.onload = function (e) {
                audioContext.decodeAudioData(e.target.result, function (buffer) {
                    console.log("Sound loaded: " + file.name);
                    theBuffer = buffer;
                    audioUsher.webAudioInit.processNodes.initialize();
                    audioUsher.connector.connectNodes();
                    callback(buffer);
                });
            };
            reader.readAsArrayBuffer(file);
        },
        onFileChosen: function (e) {                                            
            // Disable the playback buttons during loading
            $("#play-button").hide();
            document.getElementById("play-button").disabled = true;
            // Set the source buffer to be that of the chosen file
            var file = e.target.files[0];
            ui.bufferFromFile(file, function (buffer) {
                $("#play-button").show();
                $("#sample-button").hide();
                document.getElementById("play-button").disabled = false;
            });
        }
    }
});
