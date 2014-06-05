window.sha1hex = function(x) {
  return (new jsSHA(x, "TEXT")).getHash("SHA-1", "HEX");
};
