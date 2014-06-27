var SignedHeader = function(hashFunc, checksign, text, validId){
  this._hashFunc  = hashFunc;
  this._checksign = checksign;
  this._pubkey    = null;
  this._firstSignature = null;
  this._lastSignature  = null;
  this.parseText(text, validId);
  this.onchange = [];
};

SignedHeader.prototype.notifyChange = function() {
  this.onchange = this.onchange || [];
  for(var i = 0; i < this.onchange.length; i++){
    this.onchange[i].apply(this, []);
  }
}

SignedHeader.prototype.parseText = function (text, validId) {
  if(text === undefined) text = "";
  this.text = text;
  var h = text.split("\n");
  var sectionnum = 0;
  
  this.headers = [{name: null, value: "", text: "", section: sectionnum}];
  
  //
  // Parse text
  //

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
  
  //
  // Compute hash, signatures and linked list of signatures
  //
  
  var text = "";
  this._pubkey = undefined;
  this._firstSignature = null;
  this._lastSignature  = null;
  for(var i = 0; i < this.headers.length; i++) {
    var h = this.headers[i];
    if(h.name == "PublicKey" && !this._pubkey) {
      this._pubkey = h.value;
    }
    if(h.name == "Signature") {
      h.valid = this._pubkey && this._checksign(text, h.value, this._pubkey);
    }
    text += h.text;
    if(h.name == "Signature") {
      h.hashId = this._hashFunc(text);
      if(this._firstSignature === null)
        this._firstSignature = i;
      if(this._lastSignature !== null)
        this.headers[this._lastSignature].nextSignature = i;
      h.prevSignature = this._lastSignature;
      h.nextSignature = null;
      this._lastSignature = i;
    }
  }
  
  //
  // Mark valid headers
  //
  
  this.markValid(validId);

  //
  // The end
  //
  
  this.notifyChange();
}

SignedHeader.prototype.markValid = function (validId) {
  var i;
  if(this._hashFunc(this.text) == validId || validId === true) {
    i = this.headers.length - 1;
  } else {
    i = this._lastSignature;
    while(validId && i !== null) {
      var h = this.headers[i];
      if(h.valid) break;
      if(h.hashId == validId) break;
      i = h.prevSignature;
    }
  }
  while(i >= 0) {
    this.headers[i--].valid = true;
  }
}

SignedHeader.prototype.truncate = function () {
  var oldHeaders = this.headers
  var changed = false;
  this.headers = [];
  this._firstSignature = null;
  this._lastSignature  = null;
  for(var i = 0; i < oldHeaders.length; ++i) {
    var h = oldHeaders[i];
    if(!h.valid) {
      changed = true;
      break;
    }
    if(h.name == 'Signature') {
      if(this._firstSignature === null) {
        this._firstSignature = i;
      }
      this._lastSignature = i;
      if(h.nextSignature !== null && !oldHeaders[h.nextSignature].valid) {
        h.nextSignature = null;
      }
    }
    this.headers.push(h);
  }
  this._recomputeText();
  if(changed) this.notifyChange();
}

SignedHeader.prototype.checkHeaders = function (truncate) {
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
      checked = (pubkey !== undefined) && this._checksign(txt, h.value, pubkey);
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
    }
  }
  this.text    = truncate ? validtxt   : txt;
  this.headers = truncate ? validheads : heads;
  if(txt != validtxt) this.notifyChange();
  return checked;
};

SignedHeader.prototype.getLastSignedSection = function () {
  var h = this.getLastHeader() || {section: 0};
  if(h.name == "Signature") return h.section;
  return h.section - 1;
}

SignedHeader.prototype.getLastSection = function () {
  var h = this.getLastHeader() || {section: 0};
  return h.section;
}

SignedHeader.prototype.getLastUnsignedSection = function () {
  var h = this.getLastHeader() || {section: 0};
  if(h.name == "Signature") return h.section + 1;
  return h.section;
}

SignedHeader.prototype.getSectionsIds = function () {
  var ids = [];
  var text = "";
  var finished = false;
  for(var i = 0; i < this.headers.length; i++) {
    var h = this.headers[i];
    text += h.text;
    if(h.name == "Signature") {
      var h = this._hashFunc(text);
      if(h) ids.push(h);
      finished = true;
    }
  }
  var h = this._hashFunc(text);
  if(h) ids.last = h;
  return ids;
}

SignedHeader.prototype.getFirstId = function (){
  if(this._firstSignature !== null && this._firstSignature < this.headers.length) {
    return this.headers[this._firstSignature].hashId;
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

SignedHeader.prototype._fixValue = function (value) {
  if(typeof value != "string") value = JSON.stringify(value, undefined, 2);
  return value;
}

SignedHeader.prototype._escapeValue = function (value) {
  return value.replace(/\n/g, "\n ");
}

SignedHeader.prototype.addHeader = function (name, value) {
  value = this._fixValue(value);
  var text = name + ": " + this._escapeValue(value) + "\n";
  this.text += text;
  var lasthead = this.headers[this.headers.last - 1] || {section: 0};
  var h = {
    name:    name,
    text:    text,
    value:   value,
    section: lasthead.section + ((lasthead.name == "Signature") ? 1 : 0),
    valid:   true
  };
  if(name == "Signature") {
    h.hashId = this._hashFunc(this.text);
    var i = this.headers.length;
    if(this._firstSignature === null)
      this._firstSignature = i;
    if(this._lastSignature !== null)
      this.headers[this._lastSignature].nextSignature = i;
    h.prevSignature = this._lastSignature;
    h.nextSignature = null;
    this._lastSignature = i;
  }
  this.headers.push(h);
  this.notifyChange();
}

SignedHeader.prototype.addSignature = function (signfunction, addDate) {
  var h = this.getLastHeader();
  addDate = addDate === undefined ? true : !!addDate;
  if(h.name == "Signature") return false;
  if(addDate) this.addHeader("Date", (new Date()).toISOString());
  this.addHeader("Signature", signfunction(this.text));
  return true;
}

SignedHeader.prototype.getFirstHeader = function (name, exact_rev) {
  for(var i = 0; i < this.headers.length; i++) {
    var h = this.headers[i];
    if(exact_rev && h.section > exact_rev) return undefined;
    if(h.name == name && (!exact_rev || h.section == exact_rev)) return h.value;
  }
  return undefined;
}

SignedHeader.prototype.getLastHeader = function (name, exact_rev) {
  if(name === undefined) return this.headers[this.headers.length-1];
  for(var i = this.headers.length - 1; i >= 0; i--) {
    var h = this.headers[i];
    if(exact_rev && h.section < exact_rev) return undefined;
    if(h.name == name && (!exact_rev || h.section == exact_rev)) return h.value;
  }
  return undefined;
}

SignedHeader.prototype.getUnsignedHeader = function(name) {
  this.getLastHeader(name, this.getLastUnsignedSection())
}

SignedHeader.prototype.setUnsignedHeader = function (name, value) {
  if(name == "Signature") throw new Error("setUnsignedHeader(Signature, ...)");
  value = this._fixValue(value);
  for(var i = this.headers.length - 1; i >= 0; i--) {
    var h = this.headers[i];
    if(h.name == name) {
      h.value = value
      h.text  = name + ": " + this._escapeValue(value) + "\n";
      this._recomputeText();
      this.notifyChange();
      return;
    } else if(h.name == "Signature") {
      break;
    }
  }
  this.addHeader(name, value);
}

SignedHeader.prototype.getMergedHeader = function(name, version, opts) {
  opts = opts || {};
  var res = {};
  for(var i = 0; i < this.headers.length; i++) {
    var h = this.headers[i];
    if(version !== undefined && h.section > version) {
      continue;
    } else if(h.name == name) {
      res = JSON.parse(h.value);
      if(opts.append_section) {
        for(k in res) {
          try {
            res[k].section = h.section;
          } catch(e) {}
        }
      }
    } else if(h.name == name + "-Merge") {
      if(!res) res = {};
      var tmp = JSON.parse(h.value);
      try {
        for(var k in tmp) {
          res[k] = tmp[k];
          if(opts.append_section) {
            try {
              res[k].section = h.section;
            } catch(e) {}
          }
        }
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
    files = JSON.parse(this.getUnsignedHeader("Files-Merge")) || {};
  } catch(e) {}
  if(id) {
    files[path] = {
      id: id,
      headers: headers
    };
  } else {
    files[path] = null;
  }
  var lastSection = (this.headers[this.headers.length-1] || {}).section;
  var lastFiles;
  for(p in files) {
    if(files[p]) continue;
    if(!lastFiles) lastFiles = this.getMergedHeader("Files", lastSection - 1);
    if(!lastFiles[p]) delete files[p];
  }
  this.setUnsignedHeader("Files-Merge", files);
};

SignedHeader.prototype.rmFile = function(path) {
  this.addFile(path);
}

SignedHeader.prototype.getFile = function(path, version) {
  var files = this.getMergedHeader("Files", version, {append_section: true});
  return files[path] || null;
};

SignedHeader.prototype.getFileList = function(version) {
  var list = this.getMergedHeader("Files", version, {append_section: true});
  for(k in list) if(!list[k]) delete list[k];
  return list;
};

SignedHeader.prototype.toString = function() {
  return this.text;
};

SignedHeader.prototype.toJSON = function() {
  return this.text;
};


if(typeof module !== 'undefined' && module.exports) {
  module.exports = SignedHeader;
} else {
  window.SignedHeader = SignedHeader;
}
