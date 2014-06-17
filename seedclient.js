var events    = require('events');
var websocket = require('websocket');

var defaultserverurl = 'ws://perrin.mildred.fr:81/ws/p2pwebseeds';

var SeedClient = module.exports.SeedClient = function (serverurl, options){
  this.serverurl = serverurl || defaultserverurl;
  this.client = new websocket.client({});
  this.socketOptions = options;
}

SeedClient.prototype = new events.EventEmitter;

SeedClient.prototype.start = function(){
  var self = this;
  
  this.client.on('connectFailed', function(e){
    console.log("Failed to connect to " + self.serverurl + " using " + self.socketOptions.localAddress + " port " + self.socketOptions.localPort);
    console.log(e);
  });

  this.client.on('connect', function(conn){
    self.conn = conn;
    self.emit('localAddress', conn.socket.address())

    conn.on('message', function(msg){
      var data = JSON.parse(msg.utf8Data || msg.binaryData);
      self.emit('seeds', data.seeds);
      self.emit('address', data.address)
    });

    conn.on('close', function(){
      self.start();
    });
  });

  this.client.connect(this.serverurl, null, undefined, undefined, this.socketOptions);
};

SeedClient.prototype.stop = function(){
  this.conn.close();
}

