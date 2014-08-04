var kad = require('kademlia-dht');

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
  
  api.sendBlob = function(blob, blobid, content_type, cb){
    throw new Error("Not implemented");
  };

  api.getBlob = function(blobid, cache, cb) {
    srv.getObject(blobid, cb);
  };

  api.getBlobCache = function (blobid, cb) {
    return api.getBlob(blobid, true, cb);
  };

  api.getBlobNoCache = function (blobid, cb) {
    return api.getBlob(blobid, false, cb);
  };
  
  return api;

};
