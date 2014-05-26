
var express = require('express');
var sockets = require('./sockets');
var storage = require('./storage');

var app = express();
var websock = new sockets.server();

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
  app: app,
  websock: websock,
  init: function() {
    storage.addfile(__dirname + '/data');
  }
};

