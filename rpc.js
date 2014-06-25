
var kad = require('kademlia-dht');
var dns = require('dns');
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

RPC.prototype._getObject = function(fid, cb) {
  cb(Error("RPC._getObject not implemented"));
};

RPC.prototype.setUTP = function(utpServer) {
  var self = this;
  this._utpServer = utpServer;

  utpServer.connectionOptions = {
    objectMode: true
  };

  utpServer.on('connection', function(connection){
    
    var endpoint = RPC._makeURL({
      protocol: "utp+p2pws",
      host: connection.host,
      port: connection.port
    });
    
    var request = [];
    
    connection.on('data', function(data){
      if(!data.meta) return request.push(data);
      var meta = data.meta.toString();

      if(meta == "flush-request") {
        handleRequest(function(response){
          connection.write(JSON.stringify(response));
          var flush_response = new Buffer(data);
          flush_response.meta = new Buffer("flush-response");
          connection.write(flush_response);
        });
      }
    });
    
    connection.on('end', function(){
      handleRequest(function(response){
        connection.end(JSON.stringify(response));
      });
    });
    
    function handleRequest(reply){
      var requestBuf = Buffer.concat(request);
      var requestObj;
      request = [];
      try {
        requestObj = JSON.parse(requestBuf.toString(), kad.JSONReviver);
      } catch(e) {
        console.error("RPC: Received request, parse error: " + e.toString());
        console.error(requestBuf.toString());
        return reply({error: "Request Parse Error: " + e.toString()});
      }
      
      if(requestObj.request == 'kademlia') {
        return reply({ok: self._handleKadMessage(requestObj.type, endpoint, requestObj.data)});
      }
        
      if(requestObj.request == 'object') {
        self._getObject(requestObj.fid, function(err, data){
          if(err) return reply({error: err.toString()});
          reply({ok: data});
        });
        return;
      }

      if(requestObj.request == 'publicURL') {
        return reply({ok: endpoint});
      }

      reply({error: "Unknown request: " + requestBuf});
    }
  });
};

RPC.prototype._handleKadMessage = function(type, endpoint, data) {
  //console.log("RPC: receive " + type + " from " + endpoint);
  var handler = this._handlers[type];
  if(!handler) return null;
  return handler(endpoint, data);
};

RPC._parseAddress = function(endpoint) {
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

RPC.normalize = function(endpoint, callback) {
  var elems = RPC._parseAddress(endpoint);
  dns.lookup(elems.host || '127.0.0.1', function(err, addr, family){
		if(err) return callback(err);
		elems.host = addr;
		return callback(null, RPC._makeURL(elems));
	});
}

RPC._makeURL = function(address) {
  var host = address.host.indexOf(':') == -1 ? address.host : "[" + address.host + "]";
  var port = address.port ? ":" + address.port : "";
  var path = address.path || "";
  return address.protocol + "://" + host + port + path;
};

RPC.prototype._connect = function(endpoint, data, callback) {
  var self = this;
  var addr = RPC._parseAddress(endpoint);
  if(addr.protocol == "utp+p2pws") {
    var opts = {
      data: data,
      objectMode: true
    };
    this._utpServer.connect(addr.port, addr.host, opts, function(err, conn) {
      return callback(err, conn, addr);
    });
  } else {
    return callback(new Error("Unknown protocol " + addr.protocol + " in " + endpoint), null, addr);
  }
};

RPC.prototype._sendKad = function(type, endpoint, data, callback) {
  var request = {
    request: 'kademlia',
    type: type,
    data: data
  };
  
  return this.request(endpoint, request, 30, callback);
};

RPC.prototype.request = function(endpoint, request, timeout, callback) {
  if(typeof endpoint != 'string') throw new Error("Invalid endpoint " + endpoint);
  if(typeof timeout == 'function') {
    callback = timeout;
    timeout = undefined;
  }
  
  var timedOut = false;
  var timeoutId;
  if(timeout) timeoutId = setTimeout(onTimeOut, timeout * 1000);
  
  this._connect(endpoint, JSON.stringify(request), function(err, utp, addr){
    if(timeoutId) clearTimeout(timeoutId);
    if(timedOut)  return;
    if(err) {
      console.log("RPC: Could not connect to " + endpoint + ": " + err.toString());
      return callback(err);
    }
    
    var response = [];
    
    utp.on('data', function(resdata){
      response.push(resdata);
    });
    
    utp.on('end', function(){
      response = Buffer.concat(response);
      
      try {
        response = JSON.parse(response.toString(), kad.JSONReviver);
      } catch(e) {
        console.error("RPC: Cannot parse response: " + e);
        return callback(new Error("Invalid response: " + e));
      }
      
      if(response && response.error) {
        console.error("RPC: error response: " + response.error);
        return callback(new Error("Remote error: " + response.error));
      }

      if(!response || !response.ok){
        console.error("RPC: no response");
        return callback(new Error("Remote error: no response"));
      }
      
      callback(null, response.ok);
    });
    
    utp.end();
  });
  
  function onTimeOut(){
    timedOut = true;
    callback(new Error('timeout'));
  }
};

RPC.prototype.getPublicURL = function(endpoint, timeout, cb) {
  return this.request(endpoint, {request: "publicURL"}, timeout, cb);
};

RPC.prototype.getObject = function(endpoint, fid, timeout, cb) {
  return this.request(endpoint, {request: "object", fid: fid}, timeout, cb);
};

RPC.prototype.ping = function(addr, data, cb) { return this._sendKad('ping', addr, data, cb); };
RPC.prototype.store = function(addr, data, cb) { return this._sendKad('store', addr, data, cb); };
RPC.prototype.findNode = function(addr, data, cb) { return this._sendKad('findNode', addr, data, cb); };
RPC.prototype.findValue = function(addr, data, cb) { return this._sendKad('findValue', addr, data, cb); };

RPC.prototype.receive = function(message, handler) {
  this._handlers[message] = handler;
};

RPC.prototype.close = function(){
  this._handlers = {};
};

module.exports = RPC;

