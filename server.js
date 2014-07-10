#!/usr/bin/env node

var kad        = require('kademlia-dht');
var app        = require('./app');
var rpc        = require('./rpc');
var utp        = require('utp');
var http       = require('http');
var rand       = require('./random');
var events     = require('events');
var storage    = require('./storage');
var seedclient = require('./seedclient');


module.exports = Server;
function Server(){
  this.seeds        = [];
  this.pendingseeds = 0;
  this.port = 1337;
  this.datadir = __dirname + "/data";
  // FIXME: make storage return a prototype and create a new object here instead
  this.storage = require('./storage');
  // FIXME: make app a prototype and instanciate it here
  app.initServer(this);
}

Server.prototype = new events.EventEmitter;

Server.prototype.setPort = function(p){
  this.port = p;
};

Server.prototype.setDataDir = function(d){
  this.datadir = d;
};

Server.prototype.addSeed = function(s){
  this.pendingseeds++;
  rpc.normalize(s, function(err, seed2){
    if(err)   console.log(err);
    if(seed2) this.seeds.push(seed2);
    this.pendingseeds--;
    if(this.pendingseeds == 0) {
      this.emit("seeds", this.seeds)
    }
  }.bind(this));
};

Server.prototype.registerSeedCallback = function(cb){
  this.on("seeds", cb);
  if(this.pendingseeds == 0 && this.seeds.length > 0) cb(this.seeds);
};

Server.prototype.start = function(){
  this.utpServer = utp.createServer();
  app.kadrpc.setUTP(this.utpServer);
  this.utpServer.listen(this.port, this._utpListen.bind(this));

  this.http = http.Server(app.app);

  this.http.listen(this.port, '0.0.0.0', function(){
    console.log('Server running at http://127.0.0.1:' + this.port + '/');
  }.bind(this));

  console.log('Using data directory at ' + this.datadir);
  this.storage.setDataDir(this.datadir);
};

Server.prototype.findIPAddress = function(rpc, dht, callback, oldaddr, num, timeout) {
  // FIXME: remove contact from list if too much failure (avoid spamming)
  // (and check the rest of the code for such occurences)
  num = num || 0;
  timeout = timeout || 5000;
  var self = this;
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
      return self.findIPAddress(rpc, dht, callback, myaddr, num+1);
    }
  });
  
  function tryAgain(){
    retried = true;
    return self.findIPAddress(rpc, dht, callback, oldaddr, num+1, 500);
  }
};

Server.prototype._utpListen = function(){
  var self = this;
  console.log("UTP server running on port " + this.port);
  
  kad.Dht.spawn(app.kadrpc, [], function(err, dht){
    if(err || !dht) {
      return console.log("Kad: DHT error: " + err);
    }
    self.dht = dht;
    self.registerSeedCallback(function(seeds){
      console.log("Kad: Bootstrapping with " + seeds);
      dht.bootstrap(seeds, function(err){
        if(err) {
          console.log("Kad: DHT bootstrap error " + err);
        } else {
          console.log("Kad: DHT bootstrapped " + JSON.stringify(dht.getSeeds()));
        }
        self.findIPAddress(app.kadrpc, dht, function(myaddr){
          self._start(dht, myaddr);
        });
      });
    });
  });
};

Server.prototype._start = function(dht, myaddr){
  console.log("Found self addr: " + myaddr);
  //console.log("Kad: Publish filelist");
  //console.log(this.storage.filelist);
  for(var fid in this.storage.filelist){
    this.publishItem(myaddr, dht, this.storage.filelist[fid], function(err) {
      if(err) throw err;
    });
  }
};


Server.prototype.publishItem = function(myaddr, dht, f, cb){
  var data = {
    file_at: myaddr,
    node_id: dht.id.toString(),
  };
  if(f.site) {
    data.revision = f.site.revision;
    var subdata = {
      file_at:  myaddr,
      node_id:  dht.id.toString(),
      site_id:  f.id,
      revision: f.site.revision
    };
    for(var i = 0; i < f.site.all_ids.length; i++) {
      var subid = f.site.all_ids[i];
      dht.multiset(kad.Id.fromHex(subid), dht.id.toString(), subdata, cb);
    }
  }
  dht.multiset(kad.Id.fromHex(f.id), dht.id.toString(), data, cb);
};

Server.prototype.refreshSites = function(sitelist, defaultRefresh){
  defaultRefresh = defaultRefresh || 1000 * 60 * 60; // 1 hour
  var now = new Date();
  var minNextRefresh = now + defaultRefresh;
  for(var fid in sitelist) {
    var site = sitelist[fid];
    var refresh = site.metadata.refreshInterval || defaultRefresh;
    var lastRefresh = site.lastRefresh;
    var nextRefresh;
    if(!lastRefresh || lastRefresh + refresh < now) {
      nextRefresh = now + refresh;
      storage.refreshSite(site);
    } else {
      nextRefresh = lastRefresh + refresh;
    }
    if(nextRefresh < minNextRefresh) minNextRefresh = nextRefresh;
  }
  return minNextRefresh - new Date();
};

