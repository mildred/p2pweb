var jsSHA = require('./jssha/sha.js');
  
if(typeof process == "object" && process.versions.node) {

  var crypto = (global.require || require)('crypto');

  module.exports = function(data) {
    var sum = crypto.createHash('sha1');
    sum.update(data);
    return sum.digest('hex');
  };

} else {

  module.exports = function(x) {
    return (new jsSHA(x, "TEXT")).getHash("SHA-1", "HEX");
  };

}
