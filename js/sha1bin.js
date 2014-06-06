require(['js/jssha/sha1.js'], function(){
  module.exports = function(x) {
    return atob((new jsSHA(x, "TEXT")).getHash("SHA-1", "B64"));
  };
}
