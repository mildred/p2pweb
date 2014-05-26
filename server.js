#!/usr/bin/env node

var port =  parseInt(process.argv[2]) || 1337;

var kad      = require('kademlia-dht');
var app      = require('./app');
var http     = require('http');
var stun     = require('vs-stun');
var kadwsrpc = require('./kadwsrpc');

var kadrpc = new kadwsrpc();
var seeds = [];
var dht = null;

kad.Dht.spawn(kadrpc, seeds, function(err, dht_){
  // TODO: handle err
  dht = dht_;
});

var server = http.Server(app.app);
app.websock.listen(server);
server.listen(port);
console.log('Server running at http://localhost:' + port + '/');

console.log(server)

var stun_server = { host: 'stun.stunprotocol.org', port: 3478 }
stun.resolve(server.socket, server, function(err, value) {
  if (err) {
    console.log('Something went wrong: ' + err);
    return;
  }
  console.log(value);
  socket.close();
});


app.init();

