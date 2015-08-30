var arDrone = require('ar-drone');
var drone  = arDrone.createClient();
var http = require('http');
var fs = require('fs');
var Twitter = require('twitter');
var iotfDevice = require("ibmiotf").IotfDevice;
var Cloudant = require('cloudant');

var configFile = require('./YellowConfig.json');

console.log(configFile);

var lastPng;
var lastNavData;

var iotfConfig = configFile.iotconfig;

var twitClient = new Twitter(configFile.twitConfig);

var cloudantConfig = configFile.cloudantConfig;

try {

    // Initialize the library with my account.
    var cloudant = Cloudant({account:cloudantConfig.user, password:cloudantConfig.password});

    var droneDB = cloudant.db.use(configFile.cloudantConfig.dbName);

    var deviceClient = new iotfDevice(iotfConfig);

    deviceClient.connect();

    deviceClient.on("connect", function () {

      setInterval(function () {

        if(deviceClient.isConnected && lastNavData && lastNavData.droneState && lastNavData.demo) {
          
          deviceClient.publish("status","json",JSON.stringify({
            "d" : {
              "isFlying" : lastNavData.droneState.flying,
              "Battery" : lastNavData.demo.batteryPercentage,
              "flyState" : lastNavData.demo.flyState,
              "controlState" :lastNavData.demo.controlState
            }
            }));
        }

        if(lastPng != null) {
          var time = Math.floor(new Date());
          droneDB.insert({created : time, payload: lastPng }, time.toString(), function(err, body) {
            if (!err)
              console.log(body)
          });
        }

      }, 2000);

    });

    deviceClient.on("command", function (commandName,format,payload,topic) {

      if(commandName === "Tweet") {
        console.log("Tweet command received");
        console.log(payload.toString());
        tweetPic(payload.toString());
      } else if(commandName === "TakeOff") {
        console.log("Take OFF!!!");
        drone.takeoff();
      } else if(commandName === "Land") {
        console.log("Land!!!");
        drone.stop();
        drone.land();
      } else {
        console.log("Command not supported.. " + commandName);
      }
        
    });

    var server = http.createServer(function(req, res) {
      if (!lastPng) {
        res.writeHead(503);
        res.end('Did not receive any png data yet.');
        return;
      }

      res.writeHead(200, {'Content-Type': 'image/png'});
      res.end(lastPng);
    });  

    var PORT = 8080;

    server.listen(PORT, function(){
        console.log("Server listening on: http://localhost:%s", PORT);
    });

    /*var tserver = http.createServer(function(req, res) {
      if (!lastPng) {
        res.writeHead(503);
        res.end('Did not receive any png data yet.');
        return;
      }

      res.writeHead(200);
      tweetPic('Tweeted from G');
      res.end('tweet successful.');
    });  


    tserver.listen(8081, function(){
        console.log("Server listening on: http://localhost:%s", 8081);
    });*/

    function tweetPic (payload) {

      var msg = payload || 'Tweeted from Drone!!!';
        
        // Make post request on media endpoint. Pass file data as media parameter
      twitClient.post('media/upload', {media: lastPng}, function(error, media, response){

        if (!error) {

          // If successful, a media object will be returned.
          console.log("media upload successful");

          // Lets tweet it
          var status = {
            status: msg,
            media_ids: media.media_id_string // Pass the media id string
          }

          twitClient.post('statuses/update', status, function(error, tweet, response){
            if (!error) {
              console.log("Tweet successful");
              return;
            } else{
              console.log(error);
              return;
            }
          });

        } else{
          console.log(error);
          return;
        }

      });
    }


    //drone functions

    drone.on('navdata', function (data) {

      if(data) {
        lastNavData = data;
      }

    });

    drone.config('video:video_channel', 0);

    var pngStream = drone.getPngStream();

    pngStream.on('data', function(data){
      lastPng = data;
    });

    //uncomment this for local control of drone
    //uncomment this for local control of drone
    drone.takeoff();

  drone
    .after(3000, function() {
      this.up(1);
    })
    .after(2500, function() {
      this.stop();
      this.front(0.2);
    })
    .after(2000, function() {
      this.stop();
      this.back(0.2);
    })
    /*.after(1500, function() {
      this.stop();
      this.clockwise(1);
    })
    .after(2000, function() {
      this.stop();
      this.counterClockwise(1);
    }) */
    .after(3000, function() {
      this.stop();
    })
    .after(8000, function() {
      this.down(1);
      this.down(1);
      this.stop();
      this.land();
    });

} catch(err) {
  drone.stop();
  drone.land();
}

process.on( 'SIGINT', function() {
  console.log( "Disconnecting the client" );
  //deviceClient.disconnect();
  drone.stop();
  drone.land();
  process.exit();
});

process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err);
  drone.stop();
  drone.land();
  process.exit();
});