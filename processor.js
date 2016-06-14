var self = this;
var snapshotsGroups = [];
var minRow = 0;
var snapshots = [];

function finalCut(groups) {

    var groupsOnseted = checkTempOnsets(groups) || groups;
    var groupsOffseted = checkTempOffsets(groupsOnseted) || groupsOnseted;
    var groupsSticked = stickBrokens(groupsOffseted) || groupsOffseted;
    var groupsFilled = fillGroups(groupsSticked) || groupsSticked;
    var groupsCleaned = cleanUpGroups(groupsFilled) || groupsFilled;

    for (var i = 0; i < snapshots.length; i++) {
        console.log(snapshots[i]);
    }


    return groupsCleaned;
}

function cleanUpGroups(snapshotsGroups) {
//    for (var i = 0; i < snapshotsGroups.length; i++) {
//        if (snapshotsGroups[i].tempOffset.pointer - snapshotsGroups[i].tempOnset.pointer < minRow) {
//            snapshotsGroups.splice(i, 1);
//        }
//    }
    return snapshotsGroups;
}

function stickBrokens(snapshotsGroups) {
    for (var i = 0; i < snapshotsGroups.length; i++) {
//        console.log(snapshotsGroups[i].tempOnset);
//        console.log(snapshotsGroups[i].tempOffset);
        console.log("------------------");
        var onsetFounded = null;
        if (snapshotsGroups[i].tempOffset.pointer - snapshotsGroups[i].tempOnset.pointer < minRow) {
            // stick to group if has an onset in it
            for (var j = 0; j < snapshotsGroups[i].snapshots.length-1; j++) {
                console.log(snapshots[snapshotsGroups[i].snapshots[j].pointer - 1]);
                console.log(snapshotsGroups[i].snapshots[j]);
                console.log(snapshots[snapshotsGroups[i].snapshots[j].pointer + 1]);
                console.log(snapshotsGroups[i].snapshots[j].isOnset)
                console.log(snapshotsGroups[i]);
                console.log(snapshotsGroups[i + 1]);
//                debugger
                // check if current or 1 pos round it are onsets
                if (snapshotsGroups[i].snapshots[j].isOnset) {
                    onsetFounded = snapshotsGroups[i].snapshots[j];
                    changeOnset();
                } else if (snapshots[snapshotsGroups[i].snapshots[j].pointer - 1].isOnset) {
                    onsetFounded = snapshots[snapshotsGroups[i].snapshots[j].pointer - 1];
                    changeOnset();
                } else if (snapshots[snapshotsGroups[i].snapshots[j].pointer + 1].isOnset) {
                    onsetFounded = snapshots[snapshotsGroups[i].snapshots[j].pointer + 1];
                    changeOnset();
                }
                function changeOnset(){
                    if (onsetFounded.note === (snapshotsGroups[i + 1].tempOnset.note || snapshotsGroups[i + 1].snapshots[1].note)) {
                        
                        snapshotsGroups[i + 1].tempOnset.isOnset = false;
                        snapshotsGroups[i + 1].tempOnset = onsetFounded;
                        snapshotsGroups[i + 1].tempOnset.isOnset = true;
                        snapshotsGroups.splice(i, 1);
                    }
                }
                    
            }
        }
    }
    return snapshotsGroups;
}

function fillGroups(snapshotsGroups) {

    for (var i = 0; i < snapshotsGroups.length; i++) {

        var count = snapshotsGroups[i].tempOffset.pointer - snapshotsGroups[i].tempOnset.pointer;
        var tmpPointer = snapshotsGroups[i].tempOnset.pointer + 1;

        // fill in the snapshots array to fill again with all the missing values including
        for (var j = 0; j <= count; j++) {
            snapshotsGroups[i].snapshots.push(snapshots[tmpPointer]);
            tmpPointer++;
        }
    }
    return snapshotsGroups;
}

function checkTempOnsets(snapshotsGroups) {
    var groups = snapshotsGroups;

    // process groups array
    for (var i = 0; i < groups.length; i++) {

        var tempSnap = groups[i].tempOnset;

        // this is only for the first snapshot group - sometimes
        if (tempSnap.pointer > 2) {

//            var prev = [];
            // check while two previous amps going downwards
            for (var j = tempSnap.pointer; j > tempSnap.pointer - 2; j--) {
//                for (var k = 1; k <= minRow; k++) {
//                    prev.push(snapshots[j - k].amp);
//                }
                var prev = snapshots[j - 1].amp;
                var prev2 = snapshots[j - 2].amp;
                if (prev < prev2) {
                    tempSnap = snapshots[j];
                    if (groups[i].tempOnset !== snapshots[j]) {
                        groups[i].tempOnset = snapshots[j];

                        // set the onset attribute to avoid cut the group later due to minRow
                        groups[i].tempOnset.isOnset = true;
                        console.log('============' + snapshots[j].pointer + '=============');
//                        groups[i].snapshots.unshift(snapshots[j]);            // give dublicates
                    }
                    break;
                }
//                else {
//                    groups[i].snapshots.unshift(snapshots[j]);                // give dublicates
//                }
            }
        } else {
            // this is only for the first snapshot group - sometimes
            groups[i].tempOnset = snapshots[0];                                 // ???
        }


        var prevOffsetPointer = null;
        if (i > 0)                                                              // condition for the first group
            prevOffsetPointer = groups[i - 1].tempOffset.pointer;
        else
            prevOffsetPointer = 0;

        var curOnsetPointer = groups[i].tempOnset.pointer;

        // check if there is an onset until the previous offset
        for (var k = curOnsetPointer; k > prevOffsetPointer; k--) {
            if (snapshots[k].isOnset) {
                groups[i].tempOnset.isOnset = false;
                groups[i].tempOnset = snapshots[k];
                groups[i].tempOnset.isOnset = true;
                break;
            }
        }

    }

    // check if onsets in between
//                var onsetsCount = 0;
//                var onsetsArray = [];
//                var counter = 0;
//                console.log("-----size----" + groups[i].snapshots.length);
//                for (var k = 0; k < groups[i].snapshots.length; k = k + 2) {
//                    if (groups[i].snapshots[k].isOnset) {
//                        onsetsCount++;
//                        console.log("---------" + groups[i].snapshots[k].pointer + "-" + groups[i].tempOnset.pointer);
//                        console.log("---------" + k);
//                        onsetsArray.push(2);
////                        k += 1;
//                    }
//                }
//                if (onsetsCount > 1) {
//                    // slice a group when more than one onset are on it 
//                    var newGroups = sliceSnapshotsGroup(groups[i], onsetsArray);
//                    groups = addNewGroups(groups, newGroups, i);
//                }

    return groups;
}

function checkTempOffsets(snapshotsGroups) {
    var groups = snapshotsGroups;
    // process groups array
    for (var i = 0; i < snapshotsGroups.length-1; i++) {
        var tempSnap = groups[i].tempOffset;
        var pointer = tempSnap.pointer;
        if (snapshots[pointer + 1].amp > 10) {
            do {
                pointer++;
                var conditionFound = false;
                // condition to avoid error because when stops there is no snapshot after to check
                if (i + 1 === groups.length || pointer + 1 === snapshots.length) {
//                    console.log("crash 1");
                    conditionFound = true;
                }
                else if (((snapshots[pointer + 1].amp < 10) && (snapshots[pointer].amp < snapshots[pointer - 1].amp)) || (snapshots[pointer + 1].pointer === groups[i + 1].tempOnset.pointer)) {
//                    console.log("crash 2");
                    conditionFound = true;
                }
                else {
//                    console.log("crash 3");
                    conditionFound = false;
                }
            } while (!conditionFound)
        }
//        console.log("snapshots.length");
//        console.log(snapshots.length);
//        console.log("pointer");
//        console.log(pointer);

        groups[i].tempOffset = snapshots[pointer];
    }
    return groups;
}

self.addEventListener('message', function (e) {
    minRow = e.data.minRow;
    snapshots = JSON.parse(e.data.snapshots);
    snapshotsGroups = finalCut(JSON.parse(e.data.groups));
    self.postMessage(JSON.stringify(snapshotsGroups));
    //DEBUG
////console.log('===============================================');
//        for (var i = 0; i < snapshotsGroups.length; i++)
//                console.log(snapshotsGroups[i].snapshots);
}
);
