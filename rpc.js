
var kad = require('kademlia-dht');
var util = require('util');
var events = require('events');
var UTPMsg = require('./utp_msg');

var EventEmitter = events.EventEmitter;

function RPC(){
  this._utpServer = null;
  this._handlers = {};
  this._utpConnections = {};
}

util.inherits(RPC, events.EventEmitter);

RPC.prototype.setUTP = function(utpServer) {
  var self = this;
  this._utpServer = utpServer;

  utpServer.on('connection', function(connection){
    self._setupUTP(connection, 0);
  });
};

RPC.prototype._setupUTP = function(connection, kind) {
  var self = this;
  var endpoint = this._makeURL({
    protocol: "utp+p2pws",
    host: connection.host,
    port: connection.port
  });
  
  var utp = new UTPMsg(connection, kind);
  this._utpConnections[endpoint] = utp;

  utp.on('data', function(data, id){
    console.log("UTP: receive " + data.toString());
    data = JSON.parse(data.toString(), kad.JSONReviver);
    var response = undefined;
    if(data.request == 'kademlia') {
      response = self._handleKadMessage(data.type, endpoint, data.data);
    } else if(data.request == 'publicURL') {
      response = endpoint;
    }
    if(response !== undefined)
      utp.write(JSON.stringify(response), id);
  });
  
  utp.on('end', function(){
    delete self._utpConnections[endpoint];
  });
  
  return utp;
};

RPC.prototype._handleKadMessage = function(type, endpoint, data) {
  console.log("KadUTP: receive " + type + " from " + endpoint);
  var handler = this._handlers[type];
  if(!handler) return null;
  return handler(endpoint, data);
};

RPC.prototype._parseAddress = function(endpoint) {
  var cap = /^([a-z0-9+-]+):\/\/([^:\/]+|\[[^\]+]\]+)(:([0-9]+))?(\/.*)?$/.exec(endpoint);
  if(!cap) return false;
  return {
    protocol: cap[1],
    host: cap[2],
    port: cap[4] ? parseInt(cap[4]) :
          cap[1] == "http"  ? 80 :
          cap[1] == "https" ? 443 :
          cap[1] == "ws"    ? 80 :
          cap[1] == "wss"   ? 443 :
          null,
    path: cap[5] || ""
  };
};

RPC.prototype._makeURL = function(address) {
  var host = address.host.indexOf(':') == -1 ? address.host : "[" + address.host + "]";
  var port = address.port ? ":" + address.port : "";
  var path = address.path || "";
  return address.protocol + "://" + host + port + path;
};

RPC.prototype._sendKad = function(type, endpoint, data, callback) {
  var self = this;
  var addr = this._parseAddress(endpoint);
  var request = {
    request: 'kademlia',
    type: type,
    data: data
  };

  if(addr.protocol == "utp+p2pws") {
    if(this._utpConnections[endpoint]) {
      utpSend(this._utpConnections[endpoint]);
    } else {
      this._utpServer.connect(addr.port, addr.host, function(err, connection){
        if(err) {
          console.error("KadUTP: cannot connect to " + endpoint +  ":" + err);
          return callback(err);
        }
        console.log("KadUTP: send " + type + " to " + endpoint);
        utpSend(self._setupUTP(connection, 1));
      });
    }
  } else {
    console.error("Unknown protocol " + addr.protocol);
    callback(new Error("Unknown protocol " + addr.protocol))
  }
  
  function utpSend(utp){
    utp.write(JSON.stringify(request), function(data){
      console.log("RPC: response from " + endpoint + " (" + type + "): " + data);
      try {
        data = JSON.parse(data.toString(), kad.JSONReviver);
      } catch(e) {
        console.error("KadUTP: Cannot parse response: " + e);
        return callback(new Error("Invalid response: " + e));
      }
      if(!data){
        console.error("KadUTP: no response");
        return callback(new Error("Remote error: no response"));
      }
      callback(null, data);
    });
  }
};

RPC.prototype.ping = function(addr, data, cb) { return this._sendKad('ping', addr, data, cb); }
RPC.prototype.store = function(addr, data, cb) { return this._sendKad('store', addr, data, cb); }
RPC.prototype.findNode = function(addr, data, cb) { return this._sendKad('findNode', addr, data, cb); }
RPC.prototype.findValue = function(addr, data, cb) { return this._sendKad('findValue', addr, data, cb); }

RPC.prototype.receive = function(message, handler) {
  this._handlers[message] = handler;
};

RPC.prototype.close = function(){
  this._handlers = {};
};

module.exports = RPC;

