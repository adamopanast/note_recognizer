var express = require('express'),
        app = express();

var PORT_NUMBER = 8080;

app.use(express.static(__dirname + '/'));
app.listen(PORT_NUMBER);
console.log('SERVER IS UP AND RUNNING AT : ' + PORT_NUMBER);