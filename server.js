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
var rpc        = require('./rpc');
var utp        = require('utp');
var http       = require('http');
var rand       = require('./random');
var storage    = require('./storage');
var seedclient = require('./seedclient');

var findIPAddress = function findIPAddress(rpc, dht, callback, oldaddr, num) {
  num = num || 0;
  var seeds = dht.getSeeds();
  var retried = false;
  if(seeds.length == 0) {
    console.log("No seeds");
    return setTimeout(tryAgain, Math.min(num, 5) * 1000);
  }

  var seed;
  while(seed === undefined || seed.id == dht.id) {
    seed = rand.value(seeds);
  }
  var endpoint = seed.endpoint;
  console.log('Request my public URL to ' + endpoint);
  
  var retry = setTimeout(tryAgain, 5000);
  
  rpc.getPublicURL(endpoint, function(err, myaddr){
    clearTimeout(retry);
    if(err) {
      if(!retried) setTimeout(tryAgain, 0.5);
      return;
    }
    if(oldaddr != myaddr) callback(myaddr.toString());
    if(!retried) setTimeout(keepAlive, 20000);
    
    function keepAlive(){
      retried = true;
      return findIPAddress(rpc, dht, callback, myaddr, num+1);
    }
  });
  
  function tryAgain(){
    retried = true;
    return findIPAddress(rpc, dht, callback, oldaddr, num+1);
  }
};

var utpServer = utp.createServer();
app.kadrpc.setUTP(utpServer);
utpServer.listen(port, function(){
  console.log("UTP server running on port " + port);
  
  kad.Dht.spawn(app.kadrpc, [], function(err, dht){
    if(err || !dht) {
      return console.log("Kad: DHT error: " + err);
    }
    app.initDHT(dht);
    rpc.normalize(seed, function(err, seed2){
      if(seed2) console.log("Kad: Bootstrapping with " + seed2);
      if(err)   console.log(err);
      dht.bootstrap(seed2 ? [seed2] : [], function(err){
        if(err) {
          console.log("Kad: DHT bootstrap error " + err);
        } else {
          console.log("Kad: DHT bootstrapped " + JSON.stringify(dht.getSeeds()));
        }
        findIPAddress(app.kadrpc, dht, function(myaddr){
          console.log("Found self addr: " + myaddr);
          // FIXME: automatically publish keys to new contacts, and republish
          // regularly
          console.log("Kad: Publish filelist");
          console.log(app.storage.filelist);
          for(fid in app.storage.filelist){
            var keys = app.storage.filelist[fid].ids;
            for(var i = 0; i < keys.length; i++) {
              console.log("Store " + keys[i] + " " + dht.id);
              dht.multiset(keys[i], dht.id, {file_at: myaddr}, function(err){
                if(err) throw err;
              });
            }
          }
        });
      });
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


