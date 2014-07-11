var jsSHA = require('./jssha/sha.js');

module.exports = function(x) {
  return atob((new jsSHA(x, "TEXT")).getHash("SHA-1", "B64"));
};

