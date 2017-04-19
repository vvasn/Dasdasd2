/*
Created by Ville Suoraniemi on 11.4.2017.
 */

// Modules
var app = require('express')();
var http = require('http').Server(app);
var request = require('request');
var io = require('socket.io')(http);
var path = require('path');

var port = 4000;
var localhost = 'http://localhost:';

// Setting up server
http.listen(port, function(){
    console.log('Order UI available at ' + localhost + port);
    console.log('\n');
});

// Sending HTML files
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.get('/orders', function(req, res){
    res.sendFile(path.join(__dirname + '/orders.html'));
});

// Establishing socket.io connection
io.on('connection', function(socket){

    socket.on('submitOrder', function(order){

        console.log("Submit order socket io received");
        console.log(order);
        send(order);

    });


});

// Send order to Workstation 7
function send(order) {

    console.log("Sending:");
    console.log(order);

    request.post({

        headers: { "content-type" : "application/json" },
        url: 'http://localhost:4007/submit',
        json: order

    }, function (err, response, body){
        if (err) {
            console.log(err);
        }
    });
}