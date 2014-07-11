var websocket = require('websocket');

function Sockets() {
  this._sockets = {};
}

Sockets.prototype.request = function (uri, callback) {
  this._sockets[uri] = callback;
};

Sockets.prototype.connect = function (uri, callback) {
  this._sockets[uri] = function(request){
    var socket = request.accept(null, request.origin);
    return callback(request, socket);
  };
};

Sockets.prototype.listen = function(httpServer, options){
  var self = this;
  if(!options) {
    options = { autoAcceptConnections: false }
  }
  options.httpServer = httpServer;
  this._server = new websocket.server(options);
  this._server.on('request', function(request) {
    var uri = request.resourceURL.path;
    var handler = self._sockets[uri];
    if(handler) {
      handler(request);
    } else {
      request.reject(404, uri + " Not Found");
    }
  })
}

module.exports = {server: Sockets};
