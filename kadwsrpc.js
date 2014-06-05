var websocket = require('websocket');
var kad = require('kademlia-dht');

function tourl(endpoint){
  return 'ws://' + endpoint[0] + ':' + endpoint[1] + '/ws/kad';
}

function KadWebSocketRpc() {
  this.handlers = {}
}

KadWebSocketRpc.prototype.setLocalEndpoint = function(address, port){
  this._localEndpoint = [address, port];
};

KadWebSocketRpc.prototype.websocket_receive = function(request, socket){
  var self = this;
  socket.on('message', function(message) {
    var data = JSON.parse(message.utf8Data || message.binaryData, kad.JSONReviver);
    console.log("KadRpc: receive " + data.type);
    //console.log(data);
    var handler = self.handlers[data.type];
    if(handler) {
      //try {
        var endpoint = data.endpoint;
        var res = handler(endpoint, data.data);
        if(res !== undefined) {
          //console.log("KadRpc: answer " + data.type);
          //console.log(res);
          res = JSON.stringify(res)
          //console.log(res);
          socket.send(res);
        }
      //} catch(e) {
      //  console.log(e);
        // We close the connection without returning a response, this will be
        // reported as an error
      //}
    }
    socket.close();
  });
}

KadWebSocketRpc.prototype.send = function(message, endpoint, payload, cb){
  var self = this;
  var url = tourl(endpoint);
  console.log("KadRpc: send " + message + " to " + url);
  //console.log(payload);
  var client = new websocket.client({});
  var replied = false;

  client.on('connect', function(conn){
    conn.on('message', function(msg){
      console.log("KadRpc: receive " + message + " response from " + url);
      //console.log(msg.utf8Data || msg.binaryData);
      var data = JSON.parse(msg.utf8Data || msg.binaryData, kad.JSONReviver);
      //console.log(data);
      cb(null, data);
      replied = true;
    });

    conn.on('close', function(reasonCode, description){
      if(!replied) cb("Did not received a reply from " + url, null);
    });

    conn.send(JSON.stringify({type: message, data: payload, endpoint: self._localEndpoint}));
  });
  
  client.connect(url, null);
};

KadWebSocketRpc.prototype.ping = function(addr, data, cb) { return this.send('ping', addr, data, cb); }
KadWebSocketRpc.prototype.store = function(addr, data, cb) { return this.send('store', addr, data, cb); }
KadWebSocketRpc.prototype.findNode = function(addr, data, cb) { return this.send('findNode', addr, data, cb); }
KadWebSocketRpc.prototype.findValue = function(addr, data, cb) { return this.send('findValue', addr, data, cb); }

KadWebSocketRpc.prototype.receive = function(message, handler){
  this.handlers[message] = handler;
};

KadWebSocketRpc.prototype.close = function(){
  this.handlers = {}
};


module.exports = KadWebSocketRpc;
