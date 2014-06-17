#!/usr/bin/env node

var port = 1337;
var datadir = __dirname + "/data";
var seedurl = 'ws://perrin.mildred.fr:81/ws/p2pwebseeds';
var seed = null;

for(var i = 2; i < process.argv.length; i++){
  var arg = process.argv[i];
  if(arg == "-port") {
    port = parseInt(process.argv[++i]);
  } else if(arg == "-data") {
    datadir = process.argv[++i];
  } else if(arg == "-seedurl") {
    seedurl = process.argv[++i];
  } else if(arg == "-seed") {
    seed = process.argv[++i];
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
var utp        = require('utp');
var http       = require('http');
var storage    = require('./storage');
var seedclient = require('./seedclient');

var utpServer = utp.createServer();
app.kadrpc.setUTP(utpServer);
utpServer.listen(port, function(){
  console.log("UTP server running on port " + port);
  
  kad.Dht.spawn(app.kadrpc, [], function(err, dht){
    if(err || !dht) {
      return console.log("Kad: DHT error: " + err);
    }
    app.initDHT(dht);
    console.log("Kad: DHT started");
    if(seed) console.log("Kad: Bootstrapping with " + seed);
    dht.bootstrap(seed ? [seed] : [], function(err){
      if(err) {
        console.log("Kad: DHT bootstrap error " + err);
      } else {
        console.log("Kad: DHT bootstrapped " + JSON.stringify(dht.getSeeds()));
      }
      // FIXME: automatically publish keys to new contacts, and republish
      // regularly
      for(fid in app.storage.filelist){
        var keys = app.storage.filelist[fid].ids;
        for(var i = 0; i < keys.length; i++) {
          dht.multiset(keys[i], dht.id, {file_at: myaddr}, function(err){
            if(err) throw err;
          });
        }
      }
    });
  });
});

var server = http.Server(app.app);
app.websock.listen(server);

server.listen(port, '0.0.0.0', function(){
  console.log('Server running at http://127.0.0.1:' + port + '/');
});

/*

var seedc  = new seedclient.SeedClient(seedurl, {
  //localAddress: '127.0.0.1', // FIXME
  localPort: port
});
var seeds = [];
var myaddr;

seedc.on('seeds', function(s){
  seeds = s;
  console.log("Kad: starting with seeds");
  console.log(seeds);
  kad.Dht.spawn(app.kadrpc, seeds, function(err, dht){
    if(err) {
      console.log("Kad error: " + err);
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
});

seedc.on('localAddress', function(addr){
  console.log("Local address to bind to:");
  console.log(addr);
  
  app.kadrpc.setLocalEndpoint(addr.address, addr.port);

  server.listen(addr.port, addr.address, function(){
    console.log('Server running at http://' + addr.address + ':' + addr.port + '/');
  });
});

seedc.start();

*/

console.log('Using data directory at ' + datadir);
app.init(datadir);


