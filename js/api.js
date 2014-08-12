var MetaHeaders = require('./metaheaders');

var api = {};

api.removeSeed = function(id, cb) {
  cb(new Error("not supported as remote operation"));
};

var blobCache = {};

api.sendBlob = function(blob, blobid, mh, cb){
  blobCache[blobid] = {data: blob, mh: mh};
  var r = new XMLHttpRequest();
  r.open("PUT", "/obj/" + blobid);
  mh.setRequestHeaders(r);
  r.onreadystatechange = function(){
    if(!r.status || !r.responseText) return;
    if(r.status >= 400) {
      var e = new Error(r.responseText);
      e.statusCode = r.status;
      e.statusMessage = r.statusText;
      cb(e);
    }
    else cb(null, blobid);
    r.onreadystatechange = undefined;
  };
  r.send(blob);
};

api.getBlob = function(blobid, cache, cb) { // cb(err, data:string, metaheaders)
  if(blobid === undefined) throw new Error("id is undefined");
  if(typeof cache == "function") {
    cb = cache;
    cache = true;
  }
  if(cache && blobCache[blobid]) {
    return cb(null, blobCache[blobid].data, blobCache[blobid].mh);
  }
  var r = new XMLHttpRequest();
  r.open("GET", "/obj/" + blobid);
  r.onreadystatechange = function(){
    if(r.readyState < 4) return;
    if(r.status >= 400) {
      cb(new Error(r.status + " " + r.statusText + ":\n" + r.responseText));
    } else {
      var mh = new MetaHeaders(r.getResponseHeader.bind(r));
      blobCache[blobid] = {mh: mh, data: r.responseText};
      cb(null, r.responseText, mh);
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
