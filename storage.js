var fs      = require('fs');
var tmp     = require('tmp');
var kad     = require('kademlia-dht');
var path    = require('path');
var crypto  = require('crypto');
var random  = require('./random');
var sha1sum = require('./sha1sum');
var verifysign = require('./verifysign');
var SignedHeader = require('./js/signedheader');

var datadir = __dirname + '/data';

var filelist = {};
var sitelist = {};

var isp2pws = function(headers){
  return /^application\/vnd.p2pws(;.*)$/.test(headers["content-type"]);
};

var register_file = function(fid, path, metadata, h){
  // FIXME: refactoring parameters
  //console.log("Register " + fid + " " + path);

  var all_signed_ids, all_extra_ids, all_ids;
  if(h) {
    all_signed_ids = h.getSectionsIds(true);
    all_extra_ids  = h.getSectionsIds(false);
    if(all_extra_ids.last != all_extra_ids[all_extra_ids.length-1]) all_extra_ids.push(all_extra_ids.last);
    all_ids        = all_signed_ids.concat(all_extra_ids)

    sitelist[fid] = {
      metadata: metadata,
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

  filelist[fid] = {
    id: fid,
    metadata: metadata,
    path: path,
    signed_ids: all_signed_ids,
    extra_ids: all_extra_ids,
    all_ids: all_ids,
    site: sitelist[fid]
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
    filelist[id] = {
      id: fid,
      metadata: metadata,
      path: path,
      signed_ids: [],
      extra_ids: [],
      all_ids: [],
      source_id: fid
    };
  }
}

var logerror = function(e) {
  if(e) console.log(e);
};

var addfile = function(file) {
  fs.stat(file, function(err, st){
    if(err) {
      console.log("Error " + file + ": " + err);
    } else if(st.isDirectory()) {
      fs.readdir(file, function(err, files){
        if (err) {
          console.log("Error " + file + ": " + err);
        } else {
          for(var i = 0; i < files.length; i++) {
            addfile(path.join(file, files[i]))
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
            register_file(real_fid, file, metadata, h);
          } else {
            register_file(key, file, metadata, null);
          }
        });
      });
    }
  });
};

var putObject = function(fid, req, callback){
  var headers = req.headers;
  var filename = path.join(datadir, fid);
  var filename_meta = filename + ".meta";
  var is_p2pws = isp2pws(headers);
  tmp.tmpName({dir: datadir}, function(err, filename_temp){
    var fh = fs.createWriteStream(filename_temp);
    var sum = crypto.createHash('sha1');
    var data = [];
    if(err) {
      callback(500, "Internal Error", err);
    } else {
      fh.on('error', function(e){
        if(callback) callback(500, "Internal Error", err);
        callback = null;
      })
      req.on('data', function(d){
        sum.update(d);
        fh.write(d);
        if(is_p2pws) data.push(d);
      });
      req.on('end', function(d){
        fh.end();
        if(!callback) {
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
          console.log("400 Bad Request: Incorrect Identifier, expected " + real_fid + " instad of " + fid);
          callback(400, "Bad Request", "Incorrect Identifier, expected " + real_fid + " instad of " + fid);
          return;
        }
        
        if(is_p2pws){
          var would_loose = [];
          var actual_ids = (filelist[real_fid] || {}).signed_ids || [];
          for(var i = 0; i < actual_ids.length; i++) {
            var loose = true;
            for(var j = 0; j < all_signed_ids.length && loose; j++) {
              if(actual_ids[i] == all_signed_ids[j]) loose = false;
            }
            if(loose) would_loose.push("#" + i + ": " + actual_ids[i]);
          }
          
          if(would_loose.length > 0) {
            console.log("400 Bad Request: P2P Website not up to date, would loose versions:\n" + would_loose.join("\n"));
            callback(400, "Bad Request", "P2P Website not up to date, would loose versions:\n" + would_loose.join("\n"));
            return;
          }
        }
        
        fs.rename(filename_temp, filename, function(e) {
          if(e) {
            callback(500, "Internal Error", "Could not rename " + e);
            return;
          }
          var metadata = {
            headers: { "content-type": headers["content-type"] }
          };
          register_file(fid, filename, metadata, h);
          callback(201, "Created", fid);
          fs.writeFile(filename_meta, JSON.stringify(metadata), logerror);
        });
      });
    }
  });
};

// getObject: fetch an object, either from the cache or from the DHT.
// FIXME: don't transmit full data but transmit in chunks
// cb(err, data, metadata)
//
var getObject = function(dht, rpc, fid, cb) {
  var f = filelist[fid];
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

module.exports = {
  getObject: getObject,
  putObject: putObject,
  filelist:  filelist,
  sitelist:  sitelist,
  setDataDir: function(dir){
    datadir = dir;
    addfile(datadir);
  }
}
