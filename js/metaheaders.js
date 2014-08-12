
function MetaHeaders(h){
  this.headers = [];
  if(typeof h == "string") {
    this.fromString(h);
  } else if(h instanceof MetaHeaders) {
    return h;
  } else if(typeof h == 'function' || typeof h == 'object') {
    this.fromHeaders(h);
  } else {
    throw new Error("MetaHeaders incorrectly initialized");
  }
}

MetaHeaders.fromContentType = function(content_type){
  return new MetaHeaders({"content-type": content_type});
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
  var signed_headers = (typeof h == 'function') ? h('x-p2pws-signed-headers') : h['x-p2pws-signed-headers'];
  var headers = (signed_headers || "").split(/\s+/).filter(function(x){ x.length > 0; });
  for(var i = 0; i < headers.length; ++i) {
    var headerval = (typeof h == 'function') ? h(headers[i]) : h[headers[i]];
    this.headers.push({
      name: headers[i].toLowerCase(),
      value: headerval || ""
    });
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

MetaHeaders.prototype.toHeaders = function(h){
  h = h || {};
  var signed_headers = [];
  for(var i = 0; i < this.headers.length; ++i) {
    var header = this.headers[i]
    signed_headers.push(header.name);
    h[header.name] = header.value;
  }
  h["x-p2pws-signed-headers"] = signed_headers.join(' ');
  return h;
};

MetaHeaders.prototype.setRequestHeaders = function(xmlHttpRequest){
  var signed_headers = [];
  for(var i = 0; i < this.headers.length; ++i) {
    var header = this.headers[i]
    signed_headers.push(header.name);
    xmlHttpRequest.setRequestHeader(header.name, header.value);
  }
  xmlHttpRequest.setRequestHeader("x-p2pws-signed-headers", signed_headers.join(' '));
};

module.exports = MetaHeaders;
