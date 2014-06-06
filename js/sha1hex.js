require(['js/jssha/sha1.js'], function(jsSHA){
  module.exports = function(x) {
    return (new jsSHA(x, "TEXT")).getHash("SHA-1", "HEX");
  };
});
