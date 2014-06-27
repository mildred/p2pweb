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

var findIPAddress = function findIPAddress(rpc, dht, callback, oldaddr, num, timeout) {
  num = num || 0;
  timeout = timeout || 5000;
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
  
  var retry = setTimeout(tryAgain, timeout);
  
  rpc.getPublicURL(endpoint, function(err, myaddr){
    clearTimeout(retry);
    if(err) {
      if(!retried) setTimeout(tryAgain, 500);
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
    return findIPAddress(rpc, dht, callback, oldaddr, num+1, 500);
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
          //console.log("Kad: Publish filelist");
          //console.log(app.storage.filelist);
          for(fid in app.storage.filelist){
            var keys = app.storage.filelist[fid].ids;
            for(var i = 0; i < keys.length; i++) {
              console.log("Store " + keys[i] + " " + dht.id);
              dht.multiset(keys[i], dht.id.toString(), {file_at: myaddr}, function(err){
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

console.log('Using data directory at ' + datadir);
app.init(datadir);


