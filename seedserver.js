#!/usr/bin/env node

var port =  process.env.PORT || parseInt(process.argv[2]) || 81;

var http    = require('http');
var express = require('express');
var sockets = require('./sockets');

var app = express();
var websock = new sockets.server();

var seeds = [];

websock.connect('/ws/p2pwebseeds', function(request, socket){
  var seedaddr;
  if(request.httpRequest.headers['x-forwarded-for']) {
    seedaddr = [request.httpRequest.headers['x-forwarded-for'], request.socket.remotePort];
    console.log(request.httpRequest.headers);
  } else {
    seedaddr = [request.socket.remoteAddress.replace(/^::ffff:/, ""), request.socket.remotePort];
  }
  var seedaddr_s = JSON.stringify(seedaddr);

  var sendSeeds = function() {
    socket.send(JSON.stringify({
      seeds: seeds,
      address: seedaddr
    }));
  }

  seeds.push(seedaddr);
  sendSeeds();
  console.log("+ " + seedaddr_s);
  
  socket.on('message', function(message) {
    //var data = JSON.parse(message.utf8Data || message.binaryData);
    //console.log(data);
    sendSeeds();
  });

  socket.on('close', function(reasonCode, description){
    // Remove all occurences of seedaddr
    var seeds2 = [];
    for(var i = 0; i < seeds.length; i++) {
      if(JSON.stringify(seeds[i]) != seedaddr_s) seeds2.push(seeds[i]);
    }
    seeds = seeds2;
    console.log("- " + seedaddr_s);
  });
});

var server = http.Server(app);
websock.listen(server);
server.listen(port, function(){
  console.log('* Server running at http://localhost:' + port + '/');
  console.log('* Seeds at ws://localhost:' + port + '/ws/p2pwebseeds');
});


