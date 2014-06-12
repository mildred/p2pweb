// './jsencrypt/jsencrypt.min.js'
//require(['./jsrsasign/jsrsasign-latest-all-min.js'], function(){

  //
  // Hashing and signing
  //
  
  module.exports.sign = function(crypt) {
    var key = (typeof crypt == "string") ? crypt : crypt.getPrivateKey();
    var rsa = new RSAKey();
    rsa.readPrivateKeyFromPEMString(key);
    return function(text){
      //return crypt.sign(text, sha1hex);
      return rsa.signString(text, "sha1");
    };
  };
  
  module.exports.checksign = function(text, sign, pubkey) {
    //var crypt = new JSEncrypt();
    //crypt.setKey(pubkey);
    //return crypt.verify(text, sign, sha1hex);
    var rsa = KEYUTIL.getKey("-----BEGIN PUBLIC KEY-----\n" + pubkey + "\n-----END PUBLIC KEY-----");
    return rsa.verifyString(text, sign);
  };

//});
