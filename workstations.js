/**
 * Created by Ville on 17.4.2017.
 */

var app = require('express')();
var http = require('http');
var request = require('request');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var refport = 4000;
var localhost = "http://localhost:";

var workstation = function workstation(location, capability) {
    this.location = location;
    this.capability = capability;   // 1 = frame, 2 = keyboard, 3 = screen
    this.color = "RED";
    this.free = true;
    this.url = '127.0.0.1';
    this.port = 1234;
    this.connections = [];
    this.flagVisited = false;
};


workstation.prototype.runServer = function() {

    this.port = refport + this.location;
    var station = this;
    var specs = [];


    var myServer = http.createServer(function (req, res) {

        var method = req.method;


        console.log("Method: " + method);

        //Handle GET
        if (method == 'GET') {

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Workstation is running.');

        } else if (method == 'POST') {

            var body = [];

            req.on('data', function(chunk) {
                body.push(chunk);
                console.log("Body: " + body.toString());

                var msg = JSON.parse(body);

                if ((msg.id == 'Z1_Changed') && (msg.payload.PalletID != '-1')){

                    // Ask WS7 for pallet information
                    station.getPalletInfo(msg.payload.PalletID);

                } else if ((msg.id == 'Z2_Changed') && (msg.payload.PalletID != '-1')){

                    // Just move pallet forward to zone 3 and
                    // set station status to 'busy'
                    station.free = false;
                    station.movePallet(23);

                } else if (((msg.id == 'Z3_Changed') && (msg.payload.PalletID != '-1')) || (msg.id == 'PenChanged')) {

                    // Draw different frames, screen or keyboards depending
                    // on the station capability

                    // Before drawing checks pen color and changes pen if needed

                    if (station.capability == '1') {

                        if (station.color == specs[3]) {

                            station.draw(parseInt(specs[0]));
                            station.updatePalletInfo(0, specs[1], specs[2], specs[8], specs);

                        } else {

                            station.changePen(specs[3]);
                            station.color = specs[3];

                        }

                    } else if (station.capability == '2') {

                        if (station.color == specs[4]) {

                            station.draw(parseInt(specs[0]) + 3);
                            station.updatePalletInfo(specs[0], 0, specs[2], specs[8], specs);

                        } else {

                            station.changePen(specs[4]);
                            station.color = specs[4];

                        }

                    } else if (station.capability == '3') {

                        if (station.color == specs[5]) {

                            station.draw(parseInt(specs[0]) + 6);
                            station.updatePalletInfo(specs[0], specs[1], 0, specs[8], specs);

                        } else {

                            station.changePen(specs[5]);
                            station.color = specs[5];

                        }

                    }

                } else if (msg.id == 'DrawEndExecution'){

                    station.movePallet(35);

                } else if((msg.id == 'Z3_Changed') && (msg.payload.PalletID = '-1')){

                    station.free = true;

                } else if ((msg.id == 'Z4_Changed') && (msg.payload.PalletID != '-1')){

                    station.movePallet(45);

                } else if (((msg.destination == 1) && (msg.paper == '0')) || (msg.paper == '2')){

                    station.movePallet(14);

                } else if ((msg.paper == '1')) {

                    // Trying to decide the next destination here
                    console.log("Current location: " + station.location);
                    console.log("Current destination: " + msg.destination);

                    var route = [];
                    var next;

                    specs = [
                        msg.frame,
                        msg.screen,
                        msg.keyboard,
                        msg.framecolor,
                        msg.screencolor,
                        msg.keyboardcolor,
                        msg.rfid,
                        msg.paper,
                        msg.destination
                    ];

                    if (msg.frame != '0') {

                        console.log("Finding next Frame workstation...");

                        route = station.find('1', []);


                    } else if ((msg.frame == '0') && (msg.screen != '0')) {

                        console.log("Finding next Screen workstation...");

                        route = station.find('2', []);

                    } else if ((msg.frame == '0') && (msg.screen == '0') && (msg.keyboard != '0')) {

                        console.log("Finding next Keyboard workstation...");

                        route = station.find('3', []);

                    }


                    if ((msg.frame == '0') && (msg.screen == '0') && (msg.keyboard == '0')){

                        station.updatePalletInfo(specs[0], specs[1], specs[2], 1, specs);

                    } else if (route !== undefined) {

                        next = route[route.length - 1].location;

                        console.log("Next destination is: " + next + ". Updating pallet info!")

                        station.updatePalletInfo(specs[0], specs[1], specs[2], next, specs);

                    }


                    if (next == station.location) {

                        station.movePallet(12);

                    } else if (next !== station.location) {

                        station.movePallet(14);

                    }

                }
        })
        }

    });

    myServer.listen(this.port, "127.0.0.1", () => {
        console.log('Workstation ' + this.location + ' is running at http://127.0.0.1:' + this.port);
});
};


workstation.prototype.initCell = function () {
    this.runServer();
    this.subscribeToStation('CNV', 'Z1_Changed');
    this.subscribeToStation('CNV', 'Z2_Changed');
    this.subscribeToStation('CNV', 'Z3_Changed');
    this.subscribeToStation('CNV', 'Z4_Changed');
    this.subscribeToStation('ROB', 'DrawEndExecution');
    this.subscribeToStation('ROB', 'PenChanged');
};


workstation.prototype.subscribeToStation = function (station, event)
{

    port = refport + this.location;
    var tag = this;

    var options = {
        uri: 'http://localhost:3000/RTU/Sim'+ station + this.location +  '/events/' + event + '/notifs',
        method: 'POST',
        json: {"destUrl": localhost + port}
    };

    request(options, function (err, response, body) {
        if (err) {
            console.log(err);
        } else {
            console.log('Subscribed to ' + station + tag.location + ' ' + event);
        }
    });

};

workstation.prototype.movePallet = function (zones) {

    port = refport + this.location;

    console.log("Requesting pallet transfer...");
    request.post('http://localhost:3000/RTU/SimCNV' + this.location + '/services/TransZone' + zones,
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Moving pallet!");
            }
        });

};

workstation.prototype.getPalletInfo = function (PalletID){

    port = refport + this.location;

    var options = {
        uri: localhost + 4007,
        method: 'POST',
        json: {
            "id" :          "getPalletInfo",
            "palletInfo":   PalletID,
            "whoAsked":     port
        }
    };

    request(options, function (err, response, body) {
        if (err){
            console.log(err);
        }
    });
};


workstation.prototype.updatePalletInfo = function (frame, screen, keyboard, dest, specs) {

    var options = {
        uri: localhost + 4007,
        method: 'POST',
        json: {
            "id" :          "updatePalletInfo",
            "PalletID" :    specs[6],
            "Info" : {
                "frame" :           frame,
                "screen" :          screen,
                "keyboard" :        keyboard,
                "framecolor" :      specs[3],
                "screencolor" :     specs[4],
                "keyboardcolor" :   specs[5],
                "destination" :     dest,
                "paper" :           specs[7],
                "rfid" :            specs[6]
            }
        }
    };

    request(options, function (err, response, body) {
        if (err){
            console.log(err);
        }

    })

};



workstation.prototype.addConnection = function (who) {
    this.connections.push(who);
};



workstation.prototype.find = function (capability, path) {

    if (capability == this.capability && this.free){
        path.push(this);
        console.log(path);
        return path;
    }

    if(!this.flagVisited){

        this.flagVisited = true;
        path.push(this);

        for (var i=0; i < this.connections.length; i++){
            return this.connections[i].find(capability, path);
        }
    }

};


workstation.prototype.draw = function (model) {

    port = refport + this.location;

    console.log("Requesting pallet transfer...");
    request.post('http://localhost:3000/RTU/SimROB' + this.location + '/services/Draw' + model,
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Drawing!");
            }
        });

};


workstation.prototype.changePen = function (color) {

    port = refport + this.location;

    console.log("Requesting pen change...");
    request.post('http://localhost:3000/RTU/SimROB' + this.location + '/services/ChangePen' + color,
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Changing pen!");
            }
        });

};


var ws2 = new workstation(2,'1');
var ws3 = new workstation(3,'1');
var ws4 = new workstation(4,'1');
var ws5 = new workstation(5,'2');
var ws6 = new workstation(6,'2');
var ws8 = new workstation(8,'2');
var ws9 = new workstation(9,'3');
var ws10 = new workstation(10,'3');
var ws11 = new workstation(11,'3');
var ws12 = new workstation(12,'3');

ws2.addConnection(ws3);
ws3.addConnection(ws4);
ws4.addConnection(ws5);
ws5.addConnection(ws6);
ws6.addConnection(ws8);
ws8.addConnection(ws9);
ws9.addConnection(ws10);
ws10.addConnection(ws11);
ws11.addConnection(ws12);
ws12.addConnection(ws2);

ws2.initCell();
ws3.initCell();
ws4.initCell();
ws5.initCell();
ws6.initCell();
ws8.initCell();
ws9.initCell();
ws10.initCell();
ws11.initCell();
ws12.initCell();