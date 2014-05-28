var websocket = require('websocket');

function tourl(endpoint){
  return 'ws://' + endpoint[0] + ':' + endpoint[1] + '/ws/kad';
}

function KadWebSocketRpc() {
  this.handlers = {}
}

KadWebSocketRpc.prototype.websocket_receive = function(request, socket){
  var self = this;
  socket.on('message', function(message) {
    var data = JSON.parse(message.utf8Data || message.binaryData);
    console.log("KadRpc: receive " + data.type);
    var handler = self.handlers[data.type];
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
  var url = tourl(endpoint);
  console.log("KadRpc: send " + message + " to " + url);
  var client = new websocket.client({});
  var replied = false;

  client.on('connect', function(conn){
    conn.on('message', function(msg){
      var data = JSON.parse(message.utf8Data || message.binaryData);
      cb(null, data);
      replied = true;
    });

    conn.on('close', function(reasonCode, description){
      if(!replied) cb("Did not received a reply from " + url, null);
    });

    conn.send(JSON.stringify({type: message, data: payload}));
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
