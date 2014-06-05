var crypto = require('crypto');

var wordwrap = function (str, width) {
  width = width || 64;
  if (!str) {
    return str;
  }
  var regex = '(.{1,' + width + '})( +|$\n?)|(.{1,' + width + '})';
  return str.match(RegExp(regex, 'g')).join('\n');
};

module.exports = function(text, sign, pubkey){
  var v = crypto.createVerify("RSA-SHA1");
  v.update(text);
  pubkey = "-----BEGIN PUBLIC KEY-----\n" + wordwrap(pubkey) + "\n-----END PUBLIC KEY-----";
  return v.verify(pubkey, sign, 'hex');
};
