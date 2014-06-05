var SignedHeader = function(checksign, text){
  this._checksign = checksign;
  this.parseCheckText(text);
};

SignedHeader.prototype.parseCheckText = function (text) {
  this.parseText(text);
  return this.checkHeaders();
}

SignedHeader.prototype.parseText = function (text) {
  if(text === undefined) text = "";
  this.text = text;
  var h = text.split("\n");
  var sectionnum = 0;
  
  this.headers = [{name: null, value: "", text: "", section: sectionnum}];

  for(var i = 0, j = 1; i < h.length; i++) {
    var n = h[i].indexOf(": ");
    var last = i == h.length-1;
    
    if(h[i][0] == ' ') {
      // line continuation, append to last header
      if(last) {
        this.headers[j-1].name   = null;
        this.headers[j-1].value  = "";
        this.headers[j-1].text  += h[i];
      } else {
        this.headers[j-1].value += "\n" + h[i].substr(1);
        this.headers[j-1].text  += h[i] + "\n";
      }
      continue;
    } else if(n != -1 && !last) {
      // start a new header
      this.headers[j] = {
        name:    h[i].substr(0, n),
        value:   h[i].substr(n + 2),
        text:    h[i] + "\n",
        section: sectionnum
      };
      if(this.headers[j].name == "Signature") sectionnum++;
      j++;
    } else {
      // nothing, just add text to last header
      this.headers[j-1].text  += h[i];
      if(!last) this.headers[j-1].text += "\n";
    }
  }
}

SignedHeader.prototype.checkHeaders = function (checksign, truncate, callbacksection) {
  checksign = checksign || this._checksign;
  truncate = (truncate === undefined) ? true : truncate;
  var txt = "";
  var validtxt = "";
  var heads = [];
  var validheads = [];
  var checked = null;
  var pubkey;
  for(var i = 0; i < this.headers.length && checked !== false; i++) {
    var h = this.headers[i];
    if(h.name == "PublicKey" && pubkey === undefined) {
      pubkey = h.value;
    }
    if(h.name == "Signature") {
      checked = (pubkey !== undefined) && checksign(txt, h.value, pubkey);
    }
    if(checked !== false) {
      txt += h.text;
      heads.push(h);
    }
    if(h.name == "Signature") {
      if(checked) {
        validtxt = txt;
        validheads = [];
        for(var j = 0; j < heads.length; j++) validheads.push(heads[j]);
      }
      if(callbacksection) callbacksection(txt, heads);
    }
  }
  this.text    = truncate ? validtxt   : txt;
  this.headers = truncate ? validheads : heads;
  return checked;
};


SignedHeader.prototype.getSectionsIds = function (hashFunc) {
  var ids = [];
  var text = "";
  for(var i = 0; i < this.headers.length; i++) {
    var h = this.headers[i];
    text += h.text;
    if(h.name == "Signature") {
      var h = hashFunc(text);
      if(h) ids.push(h);
    }
  }
  return ids;
}

SignedHeader.prototype.getFirstId = function(hashFunc){
  var text = "";
  for(var i = 0; i < this.headers.length; i++) {
    var h = this.headers[i];
    text += h.text;
    if(h.name == "Signature") return hashFunc(text);
  }
  return undefined;
};

SignedHeader.prototype._recomputeText = function(){
  var text = "";
  for(var i = 0; i < this.headers.length; i++) {
    text += this.headers[i].text;
  }
  this.text = text;
}

SignedHeader.prototype.addHeader = function (name, value) {
  var text = name + ": " + value.replace("\n", "\n ") + "\n";
  this.text += text;
  var lasthead = this.headers[this.headers.last - 1] || {section: 0};
  this.headers.push({
    name: name,
    text: text,
    value: value,
    section: lasthead.section + ((lasthead.name == "Signature") ? 1 : 0)
  });
}

SignedHeader.prototype.addSignature = function (signfunction) {
  this.addHeader("Signature", signfunction(this.text));
}

SignedHeader.prototype.getFirstHeader = function (name) {
  for(var i = 0; i < this.headers.length; i++) {
    var h = this.headers[i];
    if(h.name == name) return h.value;
  }
  return undefined;
}

SignedHeader.prototype.getLastHeader = function (name) {
  for(var i = this.headers.length - 1; i >= 0; i--) {
    var h = this.headers[i];
    if(h.name == name) return h.value;
  }
  return undefined;
}

SignedHeader.prototype.setLastHeader = function (name, value) {
  for(var i = this.headers.length - 1; i >= 0; i--) {
    var h = this.headers[i];
    if(h.name == name) {
      h.value = value
      h.text  = name + ": " + value.replace("\n", "\n ") + "\n";
      this._recomputeText();
      return;
    } else if(h.name == "Signature") {
      break;
    }
  }
  this.addHeader(name, value);
}

SignedHeader.prototype.getMergedHeader = function(name, version) {
  var res = {};
  for(var i = this.headers.length - 1; i >= 0; i--) {
    var h = this.headers[i];
    if(version !== undefined && h.section > version) {
      continue;
    } else if(h.name == name) {
      res = JSON.parse(h.value);
    } else if(h.name == name + "-Merge") {
      if(!res) res = {};
      var tmp = JSON.parse(h.value);
      try {
        for(var k in tmp) res[k] = tmp[k];
      } catch(ex) {
        res = tmp;
      }
    }
  }
  return res;
}

SignedHeader.prototype.addFile = function(path, id, headers) {
  var files = {};
  try{
    files = JSON.parse(this.getLastHeader("Files-Merge"));
  } catch(e) {}
  files[path] = {
    id: id,
    headers: headers
  };
  this.setLastHeader("Files-Merge", JSON.stringify(files));
};

SignedHeader.prototype.getFile = function(path, version) {
  var files = this.getMergedHeader("Files", version);
  return files[path];
};

SignedHeader.prototype.toString = function() {
  return this.text;
};


if(typeof module !== 'undefined' && module.exports) {
  module.exports = SignedHeader;
} else {
  window.SignedHeader = SignedHeader;
}
