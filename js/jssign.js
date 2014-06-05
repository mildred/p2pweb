// PKCS#1 (type 1) pad input string s to n bytes, and return a bigint
function pkcs1pad1(s,n) {
  if(n < s.length + 11) { // TODO: fix for utf-8
    console.error("Message too long for RSA");
    return null;
  }
  var ba = new Array();
  var i = s.length - 1;
  while(i >= 0 && n > 0) {
    var c = s.charCodeAt(i--);
    if(c < 128) { // encode using utf-8
      ba[--n] = c;
    }
    else if((c > 127) && (c < 2048)) {
      ba[--n] = (c & 63) | 128;
      ba[--n] = (c >> 6) | 192;
    }
    else {
      ba[--n] = (c & 63) | 128;
      ba[--n] = ((c >> 6) & 63) | 128;
      ba[--n] = (c >> 12) | 224;
    }
  }
  ba[--n] = 0;
  while(n > 2) { 
    ba[--n] = 0xFF;
  }
  ba[--n] = 1;
  ba[--n] = 0;
  return new BigInteger(ba);
}

// Undo PKCS#1 (type 1) padding and, if valid, return the plaintext
function pkcs1unpad2(d,n) {
  var b = d.toByteArray();
  var i = 0;
  while(i < b.length && b[i] == 0) ++i;
  if(b.length-i != n-1 || b[i] != 1)
    return null;
  ++i;
  while(b[i] != 0)
    if(++i >= b.length) return null;
  var ret = "";
  while(++i < b.length) {
    var c = b[i] & 255;
    if(c < 128) { // utf-8 decode
      ret += String.fromCharCode(c);
    }
    else if((c > 191) && (c < 224)) {
      ret += String.fromCharCode(((c & 31) << 6) | (b[i+1] & 63));
      ++i;
    }
    else {
      ret += String.fromCharCode(((c & 15) << 12) | ((b[i+1] & 63) << 6) | (b[i+2] & 63));
      i += 2;
    }
  }
  return ret;
}


/* RSA signature */

// Return the PKCS#1 RSA encryption of "text" as an even-length hex string
RSAKey.prototype.sign = function RSASign(text, digestMethod) {
	var digest = digestMethod(text); 
	var m = pkcs1pad1(digest.toString(),(this.n.bitLength()+7)>>3);
	console.log("RSASign: encryption block :- " + m.toString()); // FIXME
	if(m == null) return null;
	var c = m.modPow(this.d, this.n);
	if(c == null) return null;
	var h = c.toString(16);
	console.log("RSASign: signature (in hex) :- " + h.toString()); // FIXME
	if((h.length & 1) == 0) return h; else return "0" + h;
}

RSAKey.prototype.verify = function RSAVerify(text, signature, digestMethod) {
	var c = parseBigInt(signature, 16);
	var m = c.modPowInt(this.e, this.n);
	if (m == null) return null;
	var digest = pkcs1unpad1(m, (this.n.bitLength()+7)>>3);
	console.log("RSAVerify: message digest :- " + digest); // FIXME
	return digest == digestMethod(text);
}


/* RSA signature */

/**
 * Proxy method for RSAKey object's sign.
 *
*/
JSEncrypt.prototype.sign = function(text, digestMethod) {
	// return the RSA signature of 'string' in 'hex' format.
	try {
		return this.getKey().sign(text, digestMethod);
	} catch(ex) {
		return false;
	}
}

/**
 * Proxy method for RSAKey object's verify.
 *
*/
JSEncrypt.prototype.verify = function(text, signature, digestMethod) {
	// Return the decrypted 'digest' of the signature.
	try {
    return this.getKey().verify(text, signature, digestMethod);
	} catch(ex) {
		return false;
	}
}

/* RSA signature */


