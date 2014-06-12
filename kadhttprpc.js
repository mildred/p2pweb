var http = require('http');
var kad = require('kademlia-dht');

function tourl(endpoint){
  return 'http://' + endpoint[0] + ':' + endpoint[1] + '/rpc/kad';
}

function KadHttpRpc() {
  this.handlers = {}
}

KadHttpRpc.prototype.setLocalEndpoint = function(address, port){
  this._localEndpoint = [address, port];
};

KadHttpRpc.prototype.handle_request = function(req, res){
  var self = this;
  var data = [];
  req.on('data', function(d){
    data.push(d);
  });
  req.on('end', function(){
    var response;
    try {
      data = JSON.parse(Buffer.concat(data).toString(), kad.JSONReviver);
      console.log("/rpc/kad: receive " + data.type + " request from " + data.endpoint[0] + ":" + data.endpoint[1]);
      if(data.type == "store") {
        console.log("/rpc/kad: receive store " + data.data.key + "." + data.data.subkey);
      } else if(data.type == "findValue") {
        console.log("/rpc/kad: receive findValue " + data.data.key + "." + data.data.subkey);
      }
      var handler  = self.handlers[data.type];
      var endpoint = data.endpoint;
      response = handler(endpoint, data.data) || null;
    } catch(e) {
      console.log("/rpc/kad: receive bad request: " + e.toString());
      res.writeHead(400, "Bad Request");
      res.write(e.toString());
      res.end();
      return;
    }
    res.writeHead(200, "Ok");
    res.write(JSON.stringify(response));
    res.end();
  });
}

KadHttpRpc.prototype.send = function(message, endpoint, payload, cb){
  var self = this;
  var requestData = JSON.stringify({type: message, data: payload, endpoint: self._localEndpoint});
  var options = {
    host:   endpoint[0],
    port:   endpoint[1],
    path:   '/rpc/kad',
    method: 'POST',
    headers:{
      "Content-length": requestData.length
    }
  };
  console.log("/rpc/kad: send " + message + " to " + endpoint[0] + ":" + endpoint[1]);
  if(message == "store") {
    console.log("/rpc/kad: store " + payload.key + "." + payload.subkey + " to " + payload.id);
  } else if(message == "findValue") {
    console.log("/rpc/kad: send findValue " + payload.key + "." + payload.subkey + " to " + payload.id);
  }
  var req = http.request(options, function(res){
    var data = [];
    res.on('data', function(chunk) {
      data.push(chunk);
    })
    res.on('end', function() {
      console.log("/rpc/kad: receive " + message + " response from " + endpoint[0] + ":" + endpoint[1]);
      try {
        data = JSON.parse(Buffer.concat(data).toString(), kad.JSONReviver);
        if(message == "findValue") {
          console.log(data);
        }
      } catch(e) {
        return cb(e);
      }
      return cb(null, data);
    });
  });
  req.on('error', function(e){
    console.log(e);
  });
  req.write(requestData);
  req.end();
};

KadHttpRpc.prototype.ping = function(addr, data, cb) { return this.send('ping', addr, data, cb); }
KadHttpRpc.prototype.store = function(addr, data, cb) { return this.send('store', addr, data, cb); }
KadHttpRpc.prototype.findNode = function(addr, data, cb) { return this.send('findNode', addr, data, cb); }
KadHttpRpc.prototype.findValue = function(addr, data, cb) { return this.send('findValue', addr, data, cb); }

KadHttpRpc.prototype.receive = function(message, handler){
  this.handlers[message] = handler;
};

KadHttpRpc.prototype.close = function(){
  this.handlers = {}
};


module.exports = KadHttpRpc;
