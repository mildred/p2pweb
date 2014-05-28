
var express = require('express');
var sockets = require('./sockets');
var storage = require('./storage');
var kadwsrpc = require('./kadwsrpc');

var app = express();
var websock = new sockets.server();
var kadrpc = new kadwsrpc();

app.get('/', function(req, res){
  res.sendfile(__dirname + "/index.html");
});

app.get(/^\/obj\/(.*)$/, function(req, res){
  var file = storage.filelist[req.params[0].toLowerCase()];
  res.sendfile(file);
});

websock.connect('/ws/control', function(request, socket){
  socket.on('message', function(message) {
    var data = JSON.parse(message.utf8Data || message.binaryData);
    console.log(data);
    socket.send(JSON.stringify(data));
  });
});

websock.connect('/ws/kad', function(request, socket){
  kadrpc.websocket_receive(request, socket);
});

module.exports = {
  kadrpc: kadrpc,
  app: app,
  websock: websock,
  init: function(datadir) {
    datadir = datadir || (__dirname + '/data')
    storage.addfile(datadir);
  }
};

