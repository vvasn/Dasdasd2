/**
 * Created by Ville on 18.4.2017.
 */

var app = require('express')();
var http = require('http').Server(app);
var request = require('request');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var port = 4001;
var localhost = "http://localhost:";

http.listen(port, function(){
    console.log('Workstation 1 is listening on ' + port);
    console.log('\n');
});


// Handling POST requests
app.post('/', function (req, res) {

    console.log("POST/");

    var specs = [
        req.body.frame,
        req.body.screen,
        req.body.keyboard,
        req.body.framecolor,
        req.body.screencolor,
        req.body.keyboardcolor
    ];

    if (req.body.frame == 'undefined'){

        return;

    } else if ((req.body.id == 'Z1_Changed') && (req.body.payload.PalletID != '-1')){

        console.log(req.body.id);
        movePallet(12);

    } else if ((req.body.id == 'Z2_Changed') && (req.body.payload.PalletID != '-1')){

        console.log(req.body.id);
        movePallet(23);

    } else if((req.body.id == 'Z3_Changed') && (req.body.payload.PalletID != '-1')){

        console.log(req.body.id);
        getPalletInfo(req.body.payload.PalletID)

    } else if (req.body.paper == '0') {

        console.log(req.body);
        updatePalletInfo('1', specs, req.body.rfid);
        loadPaper();

    } else if((req.body.id == 'PaperLoaded')||((req.body.paper == '1') && (req.body.keyboard !== 0))){

        console.log(req.body.id);
        movePallet(35);

    } else if ((req.body.frame == '0') && (req.body.screen == '0') && (req.body.keyboard == '0')){

        updatePalletInfo('2', specs, req.body.rfid);
        unLoadPaper();

    } else if (req.body.id == 'PaperUnloaded'){

        movePallet(35);

    }

});


// Function to ask pallet info from Workstation 7
function getPalletInfo(PalletID){

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
}


//Function for updating pallet info and destination
function updatePalletInfo(paper, specs, ID) {

    var options = {
        uri: localhost + 4007,
        method: 'POST',
        json: {
            "id" :          "updatePalletInfo",
            "PalletID": ID,
            "Info":  {
                "frame":            specs[0],
                "screen":           specs[1],
                "keyboard":         specs[2],
                "framecolor":       specs[3],
                "screencolor":      specs[4],
                "keyboardcolor":    specs[5],
                "destination":      1,
                "paper":            paper,
                "rfid":             ID
            }
        }
    };

    request(options, function (err, response, body) {
        if (err){
            console.log(err);
        }
    })

}


// Requesting simulator to move the pallet
function movePallet(zones) {

    console.log("Requesting pallet transfer...");
    request.post('http://localhost:3000/RTU/SimCNV1/services/TransZone' + zones,
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Moving pallet!");
            }
        });

}


// Function for requesting paper loading
function loadPaper() {

    console.log("Loading paper...");

    request.post('http://localhost:3000/RTU/SimROB1/services/LoadPaper',
        {form:{destUrl:"http://localhost:" + port}}, function(err, httpResponse, body) {
            if (err) {
                console.log(err);
            }
        });
}


// Function for requesting paper loading
function unLoadPaper() {

    console.log("Unloading paper...");

    request.post('http://localhost:3000/RTU/SimROB1/services/UnloadPaper',
        {form:{destUrl:"http://localhost:" + port}}, function(err, httpResponse, body) {
            if (err) {
                console.log(err);
            }
        });
}


// Subscribing to events from simulator
function subscribeToEvents() {

    request.post('http://localhost:3000/RTU/SimROB1/events/PaperLoaded/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to PaperLoaded!");
            }
        });

    request.post('http://localhost:3000/RTU/SimROB1/events/PaperUnloaded/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to PaperUnloaded!");
            }
        });

    request.post('http://localhost:3000/RTU/SimCNV1/events/Z1_Changed/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse,body){
            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to CNV1 Zone 1");
            }
        });

    request.post('http://localhost:3000/RTU/SimCNV1/events/Z2_Changed/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to CNV1 Zone 2");
            }
        });

    request.post('http://localhost:3000/RTU/SimCNV1/events/Z3_Changed/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){
            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to CNV1 Zone 3");
            }
        });
}

subscribeToEvents();