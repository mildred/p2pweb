var sha1hex = require('./sha1hex');
var api = {};

api.removeSeed = function(id, cb) {
  cb(new Error("not supported as remote operation"));
};

var blobCache = {};

api.sendBlob = function(blob, blobid, content_type, cb){
  if(typeof blobid == "function") {
    cb = blobid;
    blobid = sha1hex(blob);
  }
  blobCache[blobid] = blob;
  var r = new XMLHttpRequest();
  r.open("PUT", "/obj/" + blobid);
  r.setRequestHeader("Content-Type", content_type);
  r.onreadystatechange = function(){
    if(!r.status || !r.responseText) return;
    if(r.status >= 400) cb(r, r.responseText);
    else cb(null, blobid);
    r.onreadystatechange = undefined;
  };
  r.send(blob);
};

api.getBlob = function(blobid, cache, cb) {
  if(blobid === undefined) throw new Error("id is undefined");
  if(typeof cache == "function") {
    cb = cache;
    cache = true;
  }
  if(cache && blobCache[blobid]) {
    return cb(null, blobCache[blobid]);
  }
  var r = new XMLHttpRequest();
  r.open("GET", "/obj/" + blobid);
  r.onreadystatechange = function(){
    if(r.readyState < 4) return;
    if(r.status >= 400) {
      cb(new Error(r.status + " " + r.statusText + ":\n" + r.responseText));
    } else {
      blobCache[blobid] = r.responseText;
      cb(null, r.responseText);
    }
    r.onreadystatechange = undefined;
  };
  r.send();
};

api.getBlobCache = function(blobid, cb) {
  return api.getBlob(blobid, true, cb);
};

api.getBlobNoCache = function(blobid, cb) {
  return api.getBlob(blobid, false, cb);
};

module.exports = api;
