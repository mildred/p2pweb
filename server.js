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
  localAddress: '127.0.0.1', // FIXME
  localPort: port
});
var seeds = [];
var myaddr;
var server = http.Server(app.app);
app.websock.listen(server);

seedc.on('seeds', function(s){
  seeds = s;
  console.log("Kad: starting with seeds");
  console.log(seeds);
  kad.Dht.spawn(app.kadrpc, seeds, function(err, dht){
    if(err) {
      console.log("Ked error: " + err);
    } else {
      app.initDHT(dht);
      console.log("Kad: DHT started");
      for(fid in app.storage.filelist){
        var keys = app.storage.filelist[fid].ids;
        for(var i = 0; i < keys.length; i++) {
          dht.multiset(keys[i], dht.id, {file_at: myaddr}, function(err){
            if(err) throw err;
          });
        }
      }
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
  
  app.kadrpc.setLocalEndpoint(addr.address, addr.port);

  server.listen(addr.port, addr.address, function(){
    console.log('Server running at http://' + addr.address + ':' + addr.port + '/');
  });
})

console.log('Using data directory at ' + datadir);
seedc.start();
app.init(datadir);


