
var sha1hex = require('./sha1hex');

function MetaHeaders(h){
  this.headers = [];
  this.metaHeaders = true;
  if(typeof h == "string") {
    this.fromString(h);
  } else if(h instanceof MetaHeaders) {
    return h;
  } else if(typeof h == 'function' || typeof h == 'object') {
    this.fromHeaders(h);
  } else {
    throw new Error("MetaHeaders incorrectly initialized with " + typeof h);
  }
}

MetaHeaders.fromContentType = function(content_type){
  return new MetaHeaders({
    "content-type": content_type,
    "x-p2pws-signed-headers": "content-type"
  });
};

MetaHeaders.prototype.fromString = function(str){
  var lines = str.split("\n");
  
  for(var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var n = line.indexOf(": ");
    
    if(line[0] == ' ' && this.headers.length > 0) {
      // line continuation, append to last header
      this.headers[this.headers.length-1].value += "\n" + line.substr(1);
    } else if(line) {
      this.headers.push({
        name:  line.substr(0, n).toLowerCase(),
        value: line.substr(n + 2)
      });
    } else if (line != "") {
      throw new Error("Parsing error in MetaHeaders line " + i + ": " + line);
    }
  }
};

MetaHeaders.prototype.fromHeaders = function(h){
  var signed_headers      = (typeof h == 'function') ? h('x-p2pws-signed-headers'):
                                                       h['x-p2pws-signed-headers'];
  var signed_headers_sign = (typeof h == 'function') ? h('x-p2pws-signed-headers-signature'):
                                                       h['x-p2pws-signed-headers-signature'];
  var signed_headers_json = (typeof h == 'function') ? h('x-p2pws-signed-headers-json'):
                                                       h['x-p2pws-signed-headers-json'];
  var json = {};
  try {
    json = JSON.parse(signed_headers_json) || {};
  } catch(e) {}

  console.log(json);
  var headers = (signed_headers || "").split(/\s+/).filter(function(x){ return x.length > 0; });
  for(var i = 0; i < headers.length; ++i) {
    var headerval = json[headers[i]] || ((typeof h == 'function') ? h(headers[i]) : h[headers[i]]);
    console.log(h + ": " + json[headers[i]]);
    console.log(h + ": " + headerval);
    this.headers.push({
      name: headers[i].toLowerCase(),
      value: headerval || ""
    });
  }

  if(signed_headers_sign) {
    var expected_sign = signed_headers_sign.trim().toLowerCase();
    var actual_sign   = sha1hex(this.toString());
    if(expected_sign != actual_sign) throw new Error("Some headers have been modified. Expected signature " + expected_sign + ", actual signature: " + actual_sign);
  }
};

MetaHeaders.prototype.toString = function(){
  var res = "";
  for(var i = 0; i < this.headers.length; ++i) {
    var h = this.headers[i];
    res += h.name + ": " + h.value.replace(/\n/g, "\n ") + "\n";
  }
  return res;
};

MetaHeaders.prototype.getHeader = function(name){
  for(var i = 0; i < this.headers.length; ++i) {
    var header = this.headers[i]
    if(header.name == name) return header.value;
  }
};

MetaHeaders.prototype.toHeaders = function(h){
  h = h || {};
  var signed_headers = [];
  for(var i = 0; i < this.headers.length; ++i) {
    var header = this.headers[i]
    signed_headers.push(header.name);
    h[header.name] = header.value;
    console.log(header.name + ": " + header.value);
  }
  var json = JSON.stringify(h);
  h["x-p2pws-signed-headers"] = signed_headers.join(' ');
  h["x-p2pws-signed-headers-signature"] = sha1hex(this.toString());
  h["x-p2pws-signed-headers-json"] = json;
  return h;
};

MetaHeaders.prototype.setRequestHeaders = function(xmlHttpRequest){
  var heads = this.toHeaders();
  for(h in heads) xmlHttpRequest.setRequestHeader(h, heads[h]);
};

module.exports = MetaHeaders;
