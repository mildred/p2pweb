var jsSHA = require('./jssha/sha1.js');

module.exports = function(x) {
  return (new jsSHA(x, "TEXT")).getHash("SHA-1", "HEX");
};

