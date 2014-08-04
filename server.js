#!/usr/bin/env node

var fs         = require('fs');
var kad        = require('kademlia-dht');
var app        = require('./app');
var rpc        = require('./rpc');
var utp        = require('utp');
var http       = require('http');
var rand       = require('./random');
var events     = require('events');
var storage    = require('./storage');


module.exports = Server;
function Server(){
  this.seeds        = [];
  this.lastContact  = {};
  this.pendingseeds = 0;
  this.port = 1337;
  this.datadir = __dirname + "/data";
  this.datadirs = [];
  this.rpc = new rpc(this._rpcGetObject.bind(this));
  this.storage = new storage();
  this.app = app(this, this.rpc, this.storage);
}

Server.prototype = new events.EventEmitter;

Server.prototype._rpcGetObject = function(fid, cb){
  if(!this.dht) return cb(Error("DHT not initialized"));
  var file = this.storage.filelist[fid];
  if(!file) return cb(Error("File not available"));
  
  fs.readFile(file.path, function (err, data) {
    if(err) return cb(err);
    cb(null, {data: data.toString(), metadata: file.metadata});
  });
};

Server.prototype.setPort = function(p){
  this.port = p;
};

Server.prototype.setDataDir = function(d){
  this.datadir = d;
};

Server.prototype.addDataDir = function(d){
  this.datadirs.push(d);
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
  var self = this;
  this.utp = utp.createServer();
  this.rpc.setUTP(this.utp);
  self.port = self.port || randomPort();
  self.utp.listen(self.port, utpListening, tryAgain);
  
  function utpListening(){
    self.http = http.Server(self.app);
    self.http.once('error', disconnectUTPtryAgain);
    self.http.listen(self.port, '0.0.0.0', function(){
    
      self.http.removeListener('error', disconnectUTPtryAgain);
      console.log('Server running at http://127.0.0.1:' + self.port + '/');
      
      self.emit('listening', self.port);
      
      self._spawnDHT();

      console.log('Using data directory at ' + self.datadir);
      for(var i = 0; i < self.datadirs.length; i++) {
        self.storage.addDataDir(self.datadirs[i]);
      }
      self.storage.setDataDir(self.datadir);
    });
  }
  
  function disconnectUTPtryAgain(){
    self.utp.close();
    tryAgain();
  }
  
  function tryAgain(){
    self.port = randomPort();
    self.utp.listen(self.port, utpListening, tryAgain);
  }
  
  function randomPort(){
    return rand.int(1024+1, 65535);
  }
};

Server.prototype._spawnDHT = function(){
  var self = this;
  console.log("UTP server running on port " + this.port);
  
  kad.Dht.spawn(self.rpc, [], function(err, dht){
    if(err || !dht) {
      return console.log("Kad: DHT error: " + err);
    }
    self.dht = dht;
    var bootstrapped_once = false;
    self.registerSeedCallback(function(seeds){
      console.log("Kad: Bootstrapping with " + seeds);
      dht.bootstrap(seeds, function(err){
        if(err) {
          console.log("Kad: DHT bootstrap error " + err);
        } else {
          console.log("Kad: DHT bootstrapped " + JSON.stringify(dht.getSeeds()));
        }
        if(!bootstrapped_once) {
          bootstrapped_once = true;
          self.findIPAddress(dht, self._publishStorage.bind(self, dht));
        }
      });
    });
  });
};

Server.prototype._publishStorage = function(dht, myaddr){
  console.log("Found self addr: " + myaddr);
  //console.log("Kad: Publish filelist");
  //console.log(this.storage.filelist);
  for(var fid in this.storage.filelist){
    this.publishItem(myaddr, dht, this.storage.filelist[fid], function(err) {
      if(err) throw err;
    });
  }
};

Server.prototype.findIPAddress = function(dht, callback, oldaddr, num, timeout) {
  // FIXME: blacklist a contact from the list after too much failures
  // (don't remote it immediatly, if the problem is on out side we will loose
  // all our seeds)
  num = num || 0;
  timeout = timeout || 5000;
  var self = this;
  var seeds = dht.getSeeds();
  var retried = false;
  var seed;
  var now = new Date();
  
  while(seed === undefined) {
    if(seeds.length == 0) {
      console.log("No seeds");
      return setTimeout(tryAgain, Math.min(num, 5) * 1000);
    }
    
    var k = rand.key(seeds);
    seed = seeds[k];

    var lastContact = this.lastContact[seed.endpoint]
    
    if(seed.id == dht.id || lastContact && now - lastContact < 60000) {
      // Exclude ourselves and don't spam
      seed = undefined;
      seeds.splice(k, 1);
    }
  }
  

  var endpoint = seed.endpoint;
  this.lastContact[endpoint] = now;
  console.log('Request my public URL to ' + endpoint);
  
  var retry = setTimeout(tryAgain, timeout);
  
  this.rpc.getPublicURL(endpoint, function(err, myaddr){
    clearTimeout(retry);
    if(err) {
      if(!retried) setTimeout(tryAgain, 500);
      return;
    }
    self.emit("public-address", myaddr.toString(), endpoint);
    if(oldaddr != myaddr) callback(myaddr.toString());
    if(!retried) setTimeout(keepAlive, 20000);
    
    function keepAlive(){
      retried = true;
      return self.findIPAddress(dht, callback, myaddr, num+1);
    }
  });
  
  function tryAgain(){
    retried = true;
    return self.findIPAddress(dht, callback, oldaddr, num+1, 500);
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
      this.storage.refreshSite(site);
    } else {
      nextRefresh = lastRefresh + refresh;
    }
    if(nextRefresh < minNextRefresh) minNextRefresh = nextRefresh;
  }
  return minNextRefresh - new Date();
};

Server.prototype.getObject = function(fid, cb){
  this.storage.getObject(this.dht, this.rpc, fid, cb)
}
