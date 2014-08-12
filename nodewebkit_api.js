var kad = require('kademlia-dht');
var MetaHeaders = require('./js/metaheaders');

module.exports = function(srv){

  var api = {};
  
  api.removeSeed = function(id, cb) {
    if(!srv.dht) return cb(new Error("DHT not initialized"));
    if(srv.dht.getRoutes().remove(kad.Id.fromHex(id))) {
      return cb();
    } else {
      return cb(new Error("Node " + id + " not found in routing table"));
    }
  };
  
  api.sendBlob = function(blob, blobid, mh, cb){
    var headers = mh.toHeaders(); // FIXME
    srv.putObject(blobid, headers, blob, cb)
  };

  api.getBlob = function(blobid, cache, cb) { // cb(err, data:string, metaheaders)
    srv.getObject(blobid, function(err, data, metadata){
      var mh = new MetaHeaders(metadata.headers);
      cb(err, data, mh);
    });
  };

  api.getBlobCache = function (blobid, cb) {
    return api.getBlob(blobid, true, cb);
  };

  api.getBlobNoCache = function (blobid, cb) {
    return api.getBlob(blobid, false, cb);
  };
  
  return api;

};
