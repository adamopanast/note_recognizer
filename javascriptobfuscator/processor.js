var _0x9f20=["\x6C\x65\x6E\x67\x74\x68","\x74\x65\x6D\x70\x4F\x6E\x73\x65\x74","\x70\x6F\x69\x6E\x74\x65\x72","\x61\x6D\x70","\x75\x6E\x73\x68\x69\x66\x74","\x73\x6E\x61\x70\x73\x68\x6F\x74\x73","\x6D\x65\x73\x73\x61\x67\x65","\x67\x72\x6F\x75\x70\x73","\x64\x61\x74\x61","\x70\x61\x72\x73\x65","\x73\x74\x72\x69\x6E\x67\x69\x66\x79","\x70\x6F\x73\x74\x4D\x65\x73\x73\x61\x67\x65","\x61\x64\x64\x45\x76\x65\x6E\x74\x4C\x69\x73\x74\x65\x6E\x65\x72"];var self=this;var snapshotsGroups=[];function finalCut(_0xe32ex4,_0xe32ex5){_0xe32ex4=checkTempOnsets(_0xe32ex4,_0xe32ex5)||_0xe32ex4;_0xe32ex4=checkTempOffsets(_0xe32ex4,_0xe32ex5)||_0xe32ex4;return _0xe32ex4}function checkTempOnsets(snapshotsGroups,_0xe32ex5){var _0xe32ex4=snapshotsGroups;for(var _0xe32ex7=0;_0xe32ex7<snapshotsGroups[_0x9f20[0]];_0xe32ex7++){var _0xe32ex8=_0xe32ex4[_0xe32ex7][_0x9f20[1]];for(var _0xe32ex9=_0xe32ex8[_0x9f20[2]];_0xe32ex9>_0xe32ex8[_0x9f20[2]]-3;_0xe32ex9--){var _0xe32exa=_0xe32ex5[_0xe32ex9-1][_0x9f20[3]];var _0xe32exb=_0xe32ex5[_0xe32ex9-2][_0x9f20[3]];if(_0xe32exa<_0xe32exb){_0xe32ex8=_0xe32ex5[_0xe32ex9];_0xe32ex4[_0xe32ex7][_0x9f20[1]]=_0xe32ex5[_0xe32ex9];_0xe32ex4[_0xe32ex7][_0x9f20[5]][_0x9f20[4]](_0xe32ex5[_0xe32ex9]);break}else {_0xe32ex4[_0xe32ex7][_0x9f20[5]][_0x9f20[4]](_0xe32ex5[_0xe32ex9])}}};return _0xe32ex4}function checkTempOffsets(snapshotsGroups,_0xe32ex5){}self[_0x9f20[12]](_0x9f20[6],function(_0xe32exd){snapshotsGroups=finalCut(JSON[_0x9f20[9]](_0xe32exd[_0x9f20[8]][_0x9f20[7]]),JSON[_0x9f20[9]](_0xe32exd[_0x9f20[8]][_0x9f20[5]]));self[_0x9f20[11]](JSON[_0x9f20[10]](snapshotsGroups))})