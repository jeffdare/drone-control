var arDrone = require('ar-drone');
var client  = arDrone.createClient();
var http = require('http');

//client.on('navdata', console.log);
try {


var lastPng;

  client.stop();
  client.land();


client
  .after(1000, function() {
    this.stop();
    this.land();
  });

} catch(err) {
  client.stop();
  client.land();
}