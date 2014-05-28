#!/usr/bin/env node

var port = 1337;
var datadir = __dirname + "/data";
var seedurl = 'ws://perrin.mildred.fr:81/ws/p2pwebseeds';

for(var i = 2; i < process.argv.length; i++){
  var arg = process.argv[i];
  if(arg == "-port") {
    port = parseInt(process.argv[++i]);
  } else if(arg == "-data") {
    datadir = process.argv[++i];
  } else if(arg == "-seedurl") {
    seedurl = process.argv[++i];
  } else if(parseInt(arg)) {
    port = parseInt(arg);
  } else {
    if(arg != "-help") console.log("Unknown argument " + arg);
    console.log(process.argv[1] + " [-port PORTNUM] [-data DATADIR] [-seedurl WEBSOCKET] [PORTNUM]");
    console.log(process.argv[1] + " -help");
    return;
  }
}

var kad        = require('kademlia-dht');
var app        = require('./app');
var http       = require('http');
var storage    = require('./storage');
var seedclient = require('./seedclient');

var seedc  = new seedclient.SeedClient(seedurl, {
  localAddress: '127.0.0.1',
  localPort: port
});
var seeds = [];
var myaddr;
var dht = null;
var server = http.Server(app.app);
app.websock.listen(server);

seedc.on('seeds', function(s){
  seeds = s;
  console.log("Kad: starting with seeds");
  console.log(seeds);
  kad.Dht.spawn(app.kadrpc, seeds, function(err, dht_){
    if(err) {
      console.log("Ked error: " + err);
    } else {
      console.log("Kad: DHT started");
      dht = dht_;
    }
  });
});

seedc.on('address', function(addr){
  console.log("Address found on seedserver:");
  console.log(addr);
  myaddr = addr;
})

seedc.on('localAddress', function(addr){
  console.log("Local address to bind to:");
  console.log(addr);

  // FIXME EADDRINUSE: seedclient should bind to specific address, not 0.0.0.0
  // If it can be bound to specific port (the one requested on cmdline), the better
  // (requestOptions in WebSocketClient.js)
  server.listen(addr.port, addr.address, function(){
    console.log('Server running at http://' + addr.address + ':' + addr.port + '/');
  });
})

console.log('Using data directory at ' + datadir);
seedc.start();
app.init(datadir);


