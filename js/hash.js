var sha1hex     = require('./sha1hex.js');
var MetaHeaders = require('./metaheaders');

if(typeof process == "object" && process.versions.node) {

  var crypto = ((window || {}).require || require)('crypto');

  module.exports.make = function(h) {
    if(!(h instanceof MetaHeaders)) throw new Error("hash.make should take a MetaHeaders instance");
    h = h.toString();
    return function(x){
      var sum = crypto.createHash('sha1');
      sum.update(h);
      sum.update(x);
      return sum.digest('hex');
    };
  };

  module.exports.makeStream = function(h) {
    if(!(h instanceof MetaHeaders)) throw new Error("hash.make should take a MetaHeaders instance");
    var sum = crypto.createHash('sha1');
    sum.update(h.toString());
    sum.getHex = function(){
      return this.digest('hex');
    }
    return sum;
  };

} else {

  module.exports.make = function(h) {
    if(!(h instanceof MetaHeaders)) throw new Error("hash.make should take a MetaHeaders instance");
    h = h.toString();
    return function(x) {
      return sha1hex(h + x);
    };
  };

  module.exports.makeStream = function(h) {
    throw new Error("makeStream not supported on non node platforms");
  };

}

