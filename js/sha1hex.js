var jsSHA = require('./jssha/sha.js');

module.exports = function(x) {
  return (new jsSHA(x, "TEXT")).getHash("SHA-1", "HEX");
};

