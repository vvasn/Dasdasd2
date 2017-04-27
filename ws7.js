/*
Created by Ville
 */

var app = require('express')();
var http = require('http').Server(app);
var request = require('request');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var port = 4007;
var localhost = "http://localhost:";

// Storage array for pallets in production
// Pseudo database
var palletDB = [];


http.listen(port, function(){
    console.log('Workstation 7 is listening on ' + port);
    console.log('\n');
});


// Handling orders from browser UI
// Check that the received order is OK and then
// request loading a pallet for the order.
app.post('/submit', function (req, res) {

    var orderstring = JSON.stringify(req.body.information);

    var check1 = orderstring.search("Model");
    var check2 = orderstring.search("Color");

    if (check1 == -1 && check2 == -1 && req.body.id == "submitOrder") {

        console.log("\n" + "Good order! Starting production with following info:");
        console.log(req.body.information);
        loadPallet(req.body.information);

    } else {

        console.log("\n" + "ERROR!");
        console.log("Received order is missing required information." + "\n");
        console.log(req.body);

    }

});


// Handling POST requests
app.post('/', function (req, res){

    console.log("POST/");
    console.log(req.body.id);

    if (req.body.id == 'PalletLoaded'){

        var tag = req.body.payload.PalletID;

        // Initial values for new pallet before values from
        // order are assigned to them
        var palletInfo = {
            frame:              0,
            screen:             0,
            keyboard :          0,
            framecolor :        0,
            screencolor :       0,
            keyboardcolor :     0,
            destination:        1,      // Workstation number, 1-12
            paper :             0,      // 0 = no paper, 1 = paper, 2 = product ready
            rfid:               tag
        };

        // Add initialized pallet into pallet database
        updatePalletDB(tag, palletInfo);
        console.log("Pallet loaded successfully!");

    } else if (req.body.id == 'getPalletInfo'){

        var requestedInfo = palletDB[req.body.palletInfo];
        console.log("Sending info: " + JSON.stringify(requestedInfo));
        sendInfo(requestedInfo, req.body.whoAsked);

    } else if (req.body.id == 'updatePalletInfo'){

        var tag = req.body.PalletID;
        var info = req.body.Info;

        updatePalletInfo(tag, info);

    } else if ((req.body.id == 'Z1_Changed') && (req.body.payload.PalletID != '-1')){

        console.log("PalletID: " + req.body.payload.PalletID);
        movePallet(12);

    } else if ((req.body.id == 'Z2_Changed') && (req.body.payload.PalletID != '-1')){

        console.log("PalletID: " + req.body.payload.PalletID);
        movePallet(23);

    } else if ((req.body.id == 'Z3_Changed') && (req.body.payload.PalletID != '-1')) {

        var tag = req.body.payload.PalletID;

        // Pallet is deleted from the 'database' and then unloaded
        if (palletDB[tag].paper == '2'){

            delete palletDB[req.body.payload.PalletID];
            unloadPallet();

        } else {

            movePallet(35);

        }

    }

});


// Function for sending a request to load a pallet
function loadPallet(information) {

    console.log("Requesting pallet loading...");

    request.post('http://localhost:3000/RTU/SimROB7/services/LoadPallet',
        {form:{destUrl:"http://localhost:" + port}}, function(err, httpResponse, body){

            if(err) {

                console.log(err);

            } else {

                // Little delay so that the station has time to init an empty pallet
                // before saving the pallet info to it.
                setTimeout(function() {

                    var length = Object.keys(palletDB).length;
                    tag = palletDB[Object.keys(palletDB)[length-1]];

                    try {

                        updatePalletInfo(tag.rfid, information);

                    } 
                    catch (TypeError) {

                        console.log(TypeError);

                    }

                    movePallet(35);

                }, 2000);
            }

        });
}


// Function for sending a request to unload a paller
function unloadPallet() {

    console.log("Requesting pallet unloading...");

    request.post('http://localhost:3000/RTU/SimROB7/services/UnloadPallet',
        {form:{destUrl:"http://localhost:" + port}}, function(err, httpResponse, body) {

            if (err) {
                console.log(err);
            } else {
                console.log("Unloading pallet!");
            }

        });
}


// Function for adding pallet information into the storage variable
function updatePalletDB(tag, initData) {

    console.log("Attempting to update pallet DB...");

    if (!(tag in palletDB)) {

            palletDB[tag] = initData;
            console.log("Pallet DB updated!");

    } else {

        console.log("Error! Pallet ID " + tag + " already in use.")

    }
}


// Function for updating pallet info.
// Inserts "updatedInfo" into the pallet
// specified with "tag"
function updatePalletInfo(tag, updatedInfo) {

    console.log("Attempting to update pallet information...");

    if (!(tag in palletDB)) {

        console.log("Palled ID " + tag + " not found in database.")

    } else {

        updatedInfo["rfid"] = tag;
        palletDB[tag] = updatedInfo;
        console.log("Pallet info updated!");
        console.log(palletDB[tag]);
    }
}


// Requesting simulator to move the pallet
function movePallet(zones) {

    console.log("Requesting pallet transfer...");
    request.post('http://localhost:3000/RTU/SimCNV7/services/TransZone' + zones,
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){

            if (err) {
                console.log(err);
            } else {
                console.log("Moving pallet!");
            }

        });

}


// Function to send info about pallets to other agents
function sendInfo(info, who) {

    console.log("Sending info to " + localhost + who);

    request.post({

        headers: { "content-type" : "application/json" },
        url: localhost + who,
        json: info

    }, function (err, response, body){
        if (err) {
            console.log(err);
        }
    });

}


// Subscribing to simulator events.
function subscribeToEvents() {

    request.post('http://localhost:3000/RTU/reset',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){

            if (err) {
                console.log(err);
            } else {
                console.log("Simulator reset!");
            }

        });

    request.post('http://localhost:3000/RTU/SimROB7/events/PalletLoaded/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){

            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to PalletLoaded!");
            }

        });

    request.post('http://localhost:3000/RTU/SimROB7/events/PalletUnloaded/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){

            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to PalletUnloaded!");
            }

        });

    request.post('http://localhost:3000/RTU/SimCNV7/events/Z1_Changed/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse,body){

            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to CNV7 Zone 1");
            }

        });

    request.post('http://localhost:3000/RTU/SimCNV7/events/Z2_Changed/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){

            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to CNV7 Zone 2");
            }

        });

    request.post('http://localhost:3000/RTU/SimCNV7/events/Z3_Changed/notifs',
        {form:{destUrl: localhost + port}}, function(err, httpResponse, body){

            if (err) {
                console.log(err);
            } else {
                console.log("Subscribed to CNV7 Zone 3");
            }

        });
}


subscribeToEvents();