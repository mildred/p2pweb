#!/usr/bin/env node

var fs           = require('fs');
var kad          = require('kademlia-dht');
var app          = require('./app');
var rpc          = require('./rpc');
var utp          = require('utp');
var http         = require('http');
var hash         = require('./js/hash');
var rand         = require('./random');
var events       = require('events');
var stream       = require('stream');
var readAll      = require('./readall');
var storage      = require('./storage');
var verifysign   = require('./verifysign');
var MetaHeaders  = require('./js/metaheaders');
var SignedHeader = require('./js/signedheader');


module.exports = Server;
function Server(){
  var self = this;
  this.seeds        = [];
  this.lastContact  = {};
  this.pendingseeds = 0;
  this.port = 1337;
  this.datadir = __dirname + "/data";
  this.datadirs = [];
  this.rpc = new rpc(this._rpcGetObject.bind(this));
  this.storage = new storage();
  this.app = app(this, this.rpc, this.storage);
  this.bootstrapped_once = false;
}

Server.prototype = new events.EventEmitter;

Server.prototype.start = function(callback){
  var self = this;
  this.utp = utp.createServer();
  this.rpc.setUTP(this.utp);
  var canChangePort = !this.port;
  this.port = this.port || randomPort();
  
  spawnDHT(function(){
    self.utp.listen(self.port, utpListening, tryAgain);
  });

  function spawnDHT(cb){
    kad.Dht.spawn(self.rpc, [], function(err, dht){
      if(err || !dht) {
        console.trace(err);
        return setTimeout(spawnDHT.bind(this, cb), 1000);
      }
      self.dht = dht;
      cb();
    });
  }
  
  function utpListening(){
    self.http = http.Server(self.app);
    self.http.once('error', disconnectUTPtryAgain);
    self.http.listen(self.port, '0.0.0.0', function(){
    
      self.http.removeListener('error', disconnectUTPtryAgain);
      console.log('Server running at http://127.0.0.1:' + self.port + '/');
      
      self.emit('listening', self.port);
      
      console.log("UTP server running on port " + self.port);
      self._bootstrap();
      
      // FIXME: run callback once all local resource have been parsed
      if(callback) callback();

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
    if(!canChangePort) throw new Error("Cannot bind to port " + self.port);
    var oldPort = self.port;
    self.port = randomPort();
    console.log("Could not listen to UDP port " + oldPort + ", try with " + self.port);
    self.utp.listen(self.port, utpListening, tryAgain);
  }
  
  function randomPort(){
    return rand.int(1024+1, 65535);
  }
};

Server.prototype._rpcGetObject = function(fid, cb){
  if(!this.dht) return cb(Error("DHT not initialized"));
  var file = this.storage.filelist[fid];
  if(!file) return cb(Error("File not available"));
  
  fs.readFile(file.path, function (err, data) {
    if(err) {
      var str = JSON.stringify({error: err.toString()});
      var buf = new Buffer(4 + err.length);
      buf.writeInt32BE(err.length, 0);
      buf.write(str, 4);
      cb(buf);
    } else {
      var str = JSON.stringify({ok: file.metadata});
      var buf = new Buffer(4 + err.length);
      buf.writeInt32BE(err.length, 0);
      buf.write(str, 4);
      cb(buf);
      cb(data);
    }
    cb();
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
      this._bootstrap();
    }
  }.bind(this));
};

Server.prototype._bootstrap = function(){
  if(!this.dht) return;
  if(this.pendingseeds != 0) return;
  if(this.seeds.length == 0) return;

  var self = this;
  console.log("Kad: Bootstrapping with " + self.seeds);

  self.dht.bootstrap(self.seeds, function(err){
    if(err) {
      console.log("Kad: DHT bootstrap error " + err);
    } else {
      console.log("Kad: DHT bootstrapped " + JSON.stringify(self.dht.getSeeds()));
    }
    if(!self.bootstrapped_once) {
      self.bootstrapped_once = true;
      self._findIPAddress(self.dht, self._publishStorage.bind(self));
    } else if(self.myaddr) {
      self._publishStorage();
    }
  });
};

Server.prototype._findIPAddress = function(dht, callback, oldaddr, num, timeout) {
  // FIXME: blacklist a contact from the list after too much failures
  // (don't remove it immediatly, if the problem is on our side we will loose
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
  //console.log('Request my public URL to ' + endpoint);
  
  var retry = setTimeout(tryAgain, timeout);
  
  this.rpc.getPublicURL(endpoint, function(err, myaddr){
    clearTimeout(retry);
    if(err) {
      if(!retried) setTimeout(tryAgain, 500);
      return;
    }
    self.emit("public-address", myaddr.toString(), endpoint);
    self.myaddr = myaddr.toString();
    if(oldaddr != myaddr) callback(myaddr.toString());
    if(!retried) setTimeout(keepAlive, 20000);
    
    function keepAlive(){
      retried = true;
      return self._findIPAddress(dht, callback, myaddr, num+1);
    }
  });
  
  function tryAgain(){
    retried = true;
    return self._findIPAddress(dht, callback, oldaddr, num+1, 500);
  }
};

Server.prototype._publishStorage = function(){
  console.log("Found self addr: " + this.myaddr);
  //console.log("Kad: Publish filelist");
  //console.log(this.storage.filelist);
  for(var fid in this.storage.filelist){
    this._publishStorageItem(this.storage.filelist[fid], function(err) {
      if(err) console.trace(err);
    });
  }
};

Server.prototype._publishStorageItem = function(f, cb){
  var data = {
    file_at: this.myaddr,
    node_id: this.dht.id.toString(),
  };
  if(f.site) {
    data.revision = f.site.revision;
    var subdata = {
      file_at:  this.myaddr,
      node_id:  this.dht.id.toString(),
      site_id:  f.id,
      revision: f.site.revision
    };
    for(var i = 0; i < f.site.all_ids.length; i++) {
      var subid = f.site.all_ids[i];
      this.dht.multiset(kad.Id.fromHex(subid), this.dht.id.toString(), subdata, cb);
    }
  }
  this.dht.multiset(kad.Id.fromHex(f.id), this.dht.id.toString(), data, cb);
};

Server.prototype._refreshSites_ = function(sitelist, defaultRefresh){
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

Server.prototype.getSite = function(dht, rpc, fid, cb) {
  this.getObjectBuffered(fid, function(err, data, metadata){
    var mh = new MetaHeaders(metadata.headers);
    var h;
    if(data) {
      h = new SignedHeader(mh, hash.make(mh), verifysign);
      h.parseText(data.toString(), fid);
    }
    return cb(err, h, metadata);
  });
};

Server.prototype.getObjectBuffered = function(fid, cb) {
  this.getObjectStream(fid, function(err, stream, meta){
    if(err) return HandleError(err);
    if(!stream) return cb(); // No error but no data
    
    readAll(stream, function(err, data){
      if(err) return HandleError(err);
      cb(null, data, meta);
    });
      
    function HandleError(err){
      err.httpStatus = 502;
      return cb(err);
    }
  });
};

Server.prototype.getObjectStream = function(fid, cb) {
  this.storage.getObjectStream(this.dht, this.rpc, fid, cb)
};

Server.prototype.putObjectBuffered = function(fid, headers, data, cb) {
  var s = new stream.Readable();
  s.push(data);
  s.push(null);

  this.putObject(fid, headers, s, cb);
};

Server.prototype.putObject = function(fid, headers, stream, cb) {
  this.storage.putObject(fid, headers, stream, cb);
};

