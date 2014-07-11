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
  
  return api;

};
