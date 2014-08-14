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

function logerror(e) {
  if(e) console.trace(e);
}

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
  
  this.storage.on('new-resource', function(item){
    self._publishStorageItem(item, logerror);
  });
  
  this.rpc.on('new-revision', function(sourceAddr, siteid, revision, revisionList){
    self._refreshSiteFromSources(siteid, [sourceAddr]);
  });
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
      var buf = new Buffer(4 + str.length);
      buf.writeInt32BE(str.length, 0);
      buf.write(str, 4);
      cb(buf);
    } else {
      var str = JSON.stringify({ok: file.metadata});
      var buf = new Buffer(4 + str.length);
      buf.writeInt32BE(str.length, 0);
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
      self._findIPAddress();
    }
  });
};

Server.prototype._findIPAddress = function(oldaddr, num, timeout) {
  // FIXME: blacklist a contact from the list after too much failures
  // (don't remove it immediatly, if the problem is on our side we will loose
  // all our seeds)
  num = num || 0;
  timeout = timeout || 5000;
  var self = this;
  var seeds = this.dht.getSeeds();
  var retried = false;
  var seed;
  var now = Date.now();
  
  while(seed === undefined) {
    if(seeds.length == 0) {
      console.log("No seeds");
      return setTimeout(tryAgain, Math.min(num, 5) * 1000);
    }
    
    var k = rand.key(seeds);
    seed = seeds[k];

    var lastContact = this.lastContact[seed.endpoint]
    
    if(seed.id == this.dht.id || lastContact && now - lastContact < 60000) {
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
    seed.setAlive(!err);
    if(err) {
      if(!retried) setTimeout(tryAgain, 500);
      return;
    }
    self.myaddr = myaddr.toString();
    self.emit("public-address", self.myaddr, endpoint);
    if(oldaddr != myaddr) {
      console.log("Found self addr: " + self.myaddr);
      self._publishCompleteStorage();
    }
    if(!retried) setTimeout(keepAlive, 20000);
    
    function keepAlive(){
      retried = true;
      return self._findIPAddress(myaddr, num+1);
    }
  });
  
  function tryAgain(){
    retried = true;
    return self._findIPAddress(oldaddr, num+1, 500);
  }
};

Server.prototype._publishCompleteStorage = function(){
  //console.log("Kad: Publish filelist");
  //console.log(this.storage.filelist);
  for(var fid in this.storage.filelist){
    this._publishStorageItem(this.storage.filelist[fid], logerror);
  }
};

Server.prototype._publishStorageItem = function(f, cb){
  if(f.site) this._publishSite(f.id, f.site.revision, f.site.all_ids, cb);
  else       this._publishResource(f.id, cb);
};

Server.prototype._publishSite = function(siteid, revision, all_ids, cb){
  for(var i = 0; i < all_ids.length; i++) {
    this._publishResource(all_ids[i], {revision: revision, site_id: siteid}, cb);
  }
  this._publishResource(siteid, {revision: revision}, cb);
  
  // In this function we want to find all other nodes that have this
  // site at a lower revision and notify them.
  var self = this;
  console.log("Replicate " + siteid + ": look at nodes that have it.");
  this.dht.getall(kad.Id.fromHex(siteid), function(err, data){
    if(err) return console.log(err);
    if(!data) return console.log("No other node have " + siteid + ". Don't replicate.");
    
    console.log("Replicate " + siteid + " revision " + revision + " to at most " + Object.keys(data).length + " nodes");
    for(var nodeid in data) {
      var d = data[nodeid];
      if(!d.file_at) continue;
      if(typeof d.revision != 'number') continue;
      if(d.revision > revision) continue;
      console.log("Replicate " + siteid + " to: " + nodeid + " " + d.file_at);
      self.rpc.notifyNewRevision(d.file_at, siteid, revision, all_ids, logerror);
    }
  });
};

Server.prototype._publishResource = function(blobid, data, cb){
  if(typeof data == "function") {
    cb = data;
    data = {};
  }
  data.file_at = this.myaddr,
  data.node_id = this.dht.id.toString(),
  this.dht.multiset(kad.Id.fromHex(blobid), this.dht.id.toString(), data, cb);
};

Server.prototype.getSite = function(fid, cb) {
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

Server.prototype._refreshSites_ = function(sitelist, defaultRefresh){
  defaultRefresh = defaultRefresh || 1000 * 60 * 60; // 1 hour
  var now = Date.now();
  var minNextRefresh = now + defaultRefresh;
  for(var fid in sitelist) {
    var site = sitelist[fid];
    var refresh = site.metadata.refreshInterval || defaultRefresh;
    var lastRefresh = site.lastRefresh;
    var nextRefresh;
    if(!lastRefresh || lastRefresh + refresh < now) {
      nextRefresh = now + refresh;
      this._refreshSite(site.id, site.revision);
    } else {
      nextRefresh = lastRefresh + refresh;
    }
    if(nextRefresh < minNextRefresh) minNextRefresh = nextRefresh;
  }
  return minNextRefresh - Date.now();
};

Server.prototype._refreshSite = function(siteid, siterev) {
  var self = this;
  dht.getall(kad.Id.fromHex(siteid), function(err, data){
    if(err) return console.error("Refresh site " + siteid + " error: " + err);
    if(!data) return console.log("Refresh site " + siteid + ": no data");
    console.log("Refresh site " + siteid + ": network responded " + JSON.stringify(data));

    var max_rev_available = siterev + 1;
    var source_addresses = [];
    for(var k in data) {
      var d = data[k];
      if(!d.file_at || !d.revision || d.revision < max_rev_available) continue;
      if(d.revision > max_rev_available) {
        max_rev_available = d.revision;
        source_addresses = [];
      }
      source_addresses.push(d.file_at);
    }
    
    random.shuffle(source_addresses);
    self._refreshSiteFromSources(siteid, source_addresses);
  });
};

Server.prototype._refreshSiteFromSources = function(siteid, source_addresses) {
  var self = this;
  this._refreshResourceFromSources(siteid, source_addresses, logerror);
  
  this.getSite(siteid, function(err, h, metadata){
    var ids = h.getAllResourceIds();
    for(var i = 0; i < ids.length; i++){
      var id = ids[i];
      self._refreshResourceFromSources(id, source_addresses, logerror);
    }
  });
}

Server.prototype._refreshResourceFromSources = function(siteid, source_addresses, callback) {
  var i = 0;
  var self = this;
  refresh();

  function refresh(){
    if(i >= source_addresses.length) {
      console.log("Refresh resource " + siteid + ": could not find a source node.");
      callback(new Error("could not find a source node"));
      return;
    }
    var source = source_addresses[i];
    i++;
    console.log("Refresh resource " + siteid + ": Choose " + source + " in " + source_addresses.length + " nodes");
    
    self.rpc.getObjectStream(source, siteid, function(err, stream, meta){
      if(!err && stream) {
        console.log("Refresh resource " + siteid + ": " + source + " responded with a data stream");
        self.putObject(siteid, meta.headers, stream, callback);
      } else {
        if(err) return console.error("Refresh resource " + siteid + " error contacting " + source + ": " + err);
        if(!stream) return console.error("Refresh resource " + siteid + " error: no data");
        if(i < source_addresses.length) return refresh();
        else return callback(err || new Error("No data provided"));
      }
    });
  }
};

