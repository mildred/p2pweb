var fs      = require('fs');
var tmp     = require('tmp');
var path    = require('path');
var crypto  = require('crypto');
var sha1sum = require('./sha1sum');
var verifysign = require('./verifysign');
var SignedHeader = require('./js/signedheader');
  
var datadir = __dirname + '/data';

var filelist = {}

var register_file = function(fid, path, ids, metadata){
  //console.log("Register " + fid + " " + path);
  if(ids[ids.length-1] === ids[ids.length-2]) ids.pop();
  filelist[fid] = {
    metadata: metadata,
    path: path,
    ids: ids
  };
  for(var i = 0; i < ids.length; i++) {
    console.log("Register " + ids[i] + " #" + i + " " + path);
    if(ids[i] == fid) continue;
    filelist[ids[i]] = {
      metadata: metadata,
      path: path,
      ids: [],
      source_id: fid
    };
  }
}

var isp2pws = function(headers){
  return /^application\/vnd.p2pws(;.*)$/.test(headers["content-type"]);
};

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
          if(err) return;
          try{
            metadata = JSON.parse(metadata);
          } catch(e){
            metadata = {};
          }
          metadata.headers = metadata.headers || {};
          
          var key = sha1sum(data);
          
          if(isp2pws(metadata.headers)){
            var h = new SignedHeader(verifysign);
            h.parseText(data.toString());
            h.checkHeaders();
            real_fid = h.getFirstId(sha1sum) || key;
            all_ids = h.getSectionsIds(sha1sum);
            all_ids.push(all_ids.last);
            register_file(real_fid, file, all_ids, metadata);
          } else {
            register_file(key, file, [key], metadata);
          }
        });
      });
    }
  });
};

var create = function(fid, req, callback){
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
        var all_ids = [real_fid];
        if(is_p2pws){
          var h = new SignedHeader(verifysign);
          h.parseText(Buffer.concat(data).toString());
          h.checkHeaders();
          real_fid = h.getFirstId(sha1sum);
          all_ids = h.getSectionsIds(sha1sum);
          all_ids.push(digest);
        }

        if(real_fid != fid) {
          fs.unlink(filename_temp, logerror);
          callback(400, "Bad Request", "Incorrect Identifier, expected " + real_fid + " instad of " + fid);
          return;
        }
        
        if(is_p2pws){
          var would_loose = [];
          var actual_ids = (filelist[real_fid] || {}).ids || [];
          for(var i = 0; i < actual_ids.length; i++) {
            var loose = true;
            for(var j = 0; i < all_ids.length && loose; i++) {
              if(actual_ids[i] == all_ids[j]) loose = false;
            }
            if(loose) would_loose.push("#" + i + ": " + actual_ids[i]);
          }
          
          if(would_loose.length > 0) {
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
          register_file(fid, filename, all_ids, metadata);
          callback(201, "Created", fid);
          fs.writeFile(filename_meta, JSON.stringify(metadata), logerror);
        });
      });
    }
  });
}

module.exports = {
  addfile: addfile,
  create: create,
  filelist: filelist,
  setDataDir: function(dir){
    datadir = dir;
  }
}
