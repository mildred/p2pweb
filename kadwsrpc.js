var websocket = require('websocket');

function KadWebSocketRpc() {
  this.handlers = {}
}

KadWebSocketRpc.prototype.websocket_receive = function(request, socket){
  socket.on('message', function(message) {
    var data = JSON.parse(message.utf8Data || message.binaryData);
    var handler = this.handlers[data.type];
    if(handler) {
      try {
        socket.send(JSON.stringify(handler(data.data)));
      } catch(e) {
        // We close the connection without returning a response, this will be
        // reported as an error
      }
    }
    socket.close();
  });
}

KadWebSocketRpc.prototype.send = function(message, endpoint, payload, cb){
  var client = new websocket.client({});
  var socket = client.connect(endpoint, null);
  var replied = false;
  socket.send(JSON.stringify({type: message, data: payload}));
  socket.on('message', function(msg){
    var data = JSON.parse(message.utf8Data || message.binaryData);
    cb(null, data);
    replied = true;
  });
  socket.on('close', function(reasonCode, description){
    if(!replied) cb("Did not received a reply from " + endpoint, null);
  });
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
