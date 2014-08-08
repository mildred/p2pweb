var fs      = require('fs');
var tmp     = require('tmp');
var kad     = require('kademlia-dht');
var path    = require('path');
var events  = require('events');
var crypto  = require('crypto');
var random  = require('./random');
var sha1sum = require('./sha1sum');
var verifysign = require('./verifysign');
var SignedHeader = require('./js/signedheader');

function Storage() {
  this.filelist = {};
  this.sitelist = {};
  this.datadir  = __dirname + '/data';
}

Storage.prototype = new events.EventEmitter;

Storage.prototype.setDataDir = function(dir){
  this.datadir = dir;
  this.addfile(dir);
};

Storage.prototype.addDataDir = function(dir){
  this.addfile(dir);
};

Storage.prototype.getCacheSiteList = function(){
  return Object.keys(this.sitelist).map(function(id){
    return this.sitelist[id];
  }, this);
};

Storage.prototype.getCacheFileList = function(){
  return Object.keys(this.filelist).map(function(id){
    return this.filelist[id];
  }, this);
};

Storage.prototype.register_file = function(fid, path, metadata, h){
  // FIXME: refactoring parameters
  //console.log("Register " + fid + " " + path);
  var self = this;

  var all_signed_ids, all_extra_ids, all_ids;
  if(h) {
    all_signed_ids = h.getSectionsIds(true);
    all_extra_ids  = h.getSectionsIds(false);
    if(all_extra_ids.last != all_extra_ids[all_extra_ids.length-1]) all_extra_ids.push(all_extra_ids.last);
    all_ids        = all_signed_ids.concat(all_extra_ids)

    this.sitelist[fid] = {
      id:         fid,
      metadata:   metadata,
      signed_ids: all_signed_ids,
      extra_ids:  all_extra_ids,
      all_ids:    all_ids,
      revision:   h.getLastSignedSection()
    };
  } else {
    all_signed_ids = [fid];
    all_extra_ids  = [];
    all_ids        = [];
  }

  this.filelist[fid] = {
    id: fid,
    metadata: metadata,
    path: path,
    signed_ids: all_signed_ids,
    extra_ids: all_extra_ids,
    all_ids: all_ids,
    site: this.sitelist[fid]
  };

  for(var i = 0; i < all_signed_ids.length; i++) {
    registerSubId(all_signed_ids[i], i, true);
  }
  for(var i = 0; i < all_extra_ids.length; i++) {
    registerSubId(all_extra_ids[i], all_signed_ids.length + i, false);
  }

  function registerSubId(id, i, signed){
    console.log("Register " + id + " #" + i + (signed ? "" : "?") + " " + path);
    if(id == fid) return;
    self.filelist[id] = {
      id: id,
      metadata: metadata,
      path: path,
      signed_ids: [],
      extra_ids: [],
      all_ids: [],
      source_id: fid
    };
  }
}

Storage.prototype.addfile = function(file) {
  var self = this;
  fs.stat(file, function(err, st){
    if(err) {
      console.log("Error " + file + ": " + err);
    } else if(st.isDirectory()) {
      fs.readdir(file, function(err, files){
        if (err) {
          console.log("Error " + file + ": " + err);
        } else {
          for(var i = 0; i < files.length; i++) {
            self.addfile(path.join(file, files[i]))
          }
        }
      });
    } else {
      // FIXME: don't load in memory large files
      fs.readFile(file, function (err, data) {
        if (err) {
          console.log("Error " + file + ": " + err);
          return;
        }
        
        fs.readFile(file + ".meta", function(err, metadata){
          try{
            metadata = JSON.parse(metadata);
          } catch(e){
            metadata = {};
          }
          metadata.headers = metadata.headers || {};

          var key = sha1sum(data);
          
          if(isp2pws(metadata.headers)){
            var h = new SignedHeader(sha1sum, verifysign);
            h.parseText(data.toString());
            real_fid = h.getFirstId() || key;
            all_signed_ids = h.getSectionsIds(true);
            all_extra_ids = h.getSectionsIds(false);
            all_extra_ids.push(all_extra_ids.last);
            self.register_file(real_fid, file, metadata, h);
          } else {
            self.register_file(key, file, metadata, null);
          }
        });
      });
    }
  });
};

Storage.prototype.putObjectHTTP = function(fid, req, callback){
  this.putObject(fid, req.headers, function(err, ondata, onend){
    if(err) return callback(err.statusCode, err.statusMessage, err);
    
    req.on('data', ondata);
    req.on('end',  onend);
  }, end);
  
  function end(e){
    if(e) return callback(e.statusCode, e.statusMessage, e);
    return callback(201, "Created", fid);
  }
};

Storage.prototype.putObject = function(fid, headers, callback, cbend) {
  var self = this;
  var filename = path.join(this.datadir, fid);
  var filename_meta = filename + ".meta";
  var is_p2pws = isp2pws(headers);
  tmp.tmpName({dir: this.datadir}, function(err, filename_temp){
    var fh = fs.createWriteStream(filename_temp);
    var sum = crypto.createHash('sha1');
    var data = [];
    var stop = false;
    
    if(err) {
      err.statusCode = 500;
      err.statusMessage = "Internal Error";
      return callback(err);
    }
    callback(null, ondata, onend);
    
    fh.on('error', function(e){
      e.statusCode = 500;
      e.statusMessage = "Internal Error";
      if(cbend) cbend(e);
      stop = true;
    })

    function ondata(d){
      sum.update(d);
      fh.write(d);
      if(is_p2pws) data.push(d);
    }
    
    function onend() {
      fh.end();
      if(stop) {
        fs.unlink(filename_temp, logerror);
        return;
      }

      var digest = sum.digest('hex');
      var real_fid = digest;
      var all_signed_ids = [real_fid];
      var h;
      if(is_p2pws){
        h = new SignedHeader(sha1sum, verifysign);
        h.parseText(Buffer.concat(data).toString());
        real_fid = h.getFirstId();
        all_signed_ids = h.getSectionsIds(true);
      }

      if(real_fid != fid) {
        fs.unlink(filename_temp, logerror);
        var e = new Error("Incorrect Identifier, expected " + real_fid + " instad of " + fid);
        e.statusCode = 400;
        e.statusMessage = "Bad Request";
        console.error(e);
        return cbend(e);
      }
      
      if(is_p2pws){
        var would_loose = [];
        var actual_ids = (self.filelist[real_fid] || {}).signed_ids || [];
        for(var i = 0; i < actual_ids.length; i++) {
          var loose = true;
          for(var j = 0; j < all_signed_ids.length && loose; j++) {
            if(actual_ids[i] == all_signed_ids[j]) loose = false;
          }
          if(loose) would_loose.push("#" + i + ": " + actual_ids[i]);
        }
        
        if(would_loose.length > 0) {
          var e = new Error("400 Bad Request: P2P Website not up to date, would loose versions:\n" + would_loose.join("\n"));
          e.httpStatus = 400;
          e.statusMessage = "Bad Request";
          console.error(e);
          return cbend(e);
        }
      }
      
      fs.rename(filename_temp, filename, function(e) {
        if(e) {
          var e = new Error("500 Internal Error: Could not rename " + e);
          e.httpStatus = 500;
          e.statusMessage = "Internal Error";
          console.error(e);
          return cbend(e);
        }
        var metadata = {
          headers: { "content-type": headers["content-type"] }
        };
        self.register_file(fid, filename, metadata, h);
        cbend(null, fid);
        fs.writeFile(filename_meta, JSON.stringify(metadata), logerror);
      });
    }
  });  
}

// getObject: fetch an object, either from the cache or from the DHT.
// FIXME: don't transmit full data but transmit in chunks
// FIXME: store in cache
// cb(err, data, metadata)
//
Storage.prototype.getObject = function(dht, rpc, fid, cb) {
  var f = this.filelist[fid];
  if(f) {
    console.log("getObject(" + fid + "): file available locally");
    fs.readFile(f.path, function (err, data) {
      if(err) {
        err.httpStatus = 500;
        return cb(err);
      }
      cb(null, data.toString(), f.metadata);
    });
    return;
  }
  
  if(!dht) {
    console.log("getObject(" + fid + "): DHT not initialized");
    var err = new Error("DHT not initialized");
    err.httpStatus = 503
    return cb(err);
  }
  
  console.log("getObject(" + fid + "): ask the network");
  dht.getall(kad.Id.fromHex(fid), function(err, data){
    if(err) {
      console.log("getObject(" + fid + "): " + err.toString());
      err.httpStatus = 500;
      return cb(err);
    }
    if(!data) {
      console.log("getObject(" + fid + "): no data");
      return cb();
    }
    console.log("getObject(" + fid + "): network answered " + JSON.stringify(data));
    
    var availableDestinations = {};
    for(var k in data) {
      if(!data[k].file_at) continue;
      availableDestinations[k] = data[k].file_at;
    }
    var destination = random.value(availableDestinations);
    console.log("Choose " + destination + " in " + JSON.stringify(availableDestinations));

    rpc.getObject(destination, fid, 3, function(err, reply){ // FIXME: timeout
      if(err) {
        console.log("getObject(" + fid + "): " + err.toString());
        err.httpStatus = 502;
        return cb(err);
      }
      
      console.log("getObject(" + fid + "): got data (" + reply.data.length + " bytes)");
      cb(null, reply.data, reply.metadata);
    });
  });
};

Storage.prototype.refreshSite = function(rpc, site) {
  var self = this;
  dht.getall(kad.Id.fromHex(site.id), function(err, data){
    if(err) return console.error("Refresh site " + site.id + " error: " + err);
    if(!data) return console.log("Refresh site " + site.id + ": no data");
    console.log("Refresh site " + site.id + ": network responded " + JSON.stringify(data));

    var max_rev_available = site.revision + 1;
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
    
    var source = random.value(source_addresses);
    console.log("Refresh site " + site.id + ": Choose " + source + " in " + JSON.stringify(source_addresses));
    
    rpc.getObject(source, fid, function(err, reply){
      if(err) return console.error("Refresh site " + site.id + " error contacting " + source + ": " + err);
      console.log("Refresh site " + site.id + ": " + source + " responded with " + reply.data.length + " bytes");
        
      // FIXME: store in chunks
      self.putObject(fid, reply.metadata.headers, function(err, ondata, onend){
        if(err) return storeEnd(err);
        ondata(reply.data);
        onend();
      }, storeEnd);
      
      function storeEnd(e){
        // FIXME: on error, try another source
      }
    });
  });
}

function isp2pws(headers){
  return /^application\/vnd.p2pws(;.*)?$/.test(headers["content-type"]);
}

function logerror(e) {
  if(e) console.log(e);
}

module.exports = Storage;
