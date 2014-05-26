#!/usr/bin/env node

var port =  process.env.PORT || parseInt(process.argv[2]) || 80;

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
    seedaddr = [request.socket.remoteAddress, request.socket.remotePort];
  }
  var seedaddr_s = JSON.stringify(seedaddr);
  seeds.push(seedaddr);
  socket.send(JSON.stringify(seeds));
  console.log("+ " + seedaddr_s);

  socket.on('message', function(message) {
    //var data = JSON.parse(message.utf8Data || message.binaryData);
    //console.log(data);
    socket.send(JSON.stringify(seeds));
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
});


