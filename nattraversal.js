var net     = require('net');
var stun    = require('vs-stun');
var nsock   = require('sock');
var events  = require('events');
var freeice = require('freeice');
var tcp2udp = require('./tcp2udp');

//var stun_server = { host: 'stun.stunprotocol.org', port: 3478 };
var stun_server = function() {
  return { host: "stun.stunprotocol.org", port: 3478 };/*
  var server = freeice()[0];
  console.log(server);
  var parts = server.url.split(':');
  return {host: parts[1], port: parseInt(parts[2]) || 3478};*/
}

function NatTraversal(socket) {
  this.socket = socket;
  this.localaddr = socket.address();
  this.remoteaddr = { port: null, family: this.localaddr.family, address: null };
}

NatTraversal.prototype = new events.EventEmitter;

NatTraversal.prototype.is_natted = function(){
  return this.localaddr.port != this.remoteaddr.port || this.localaddr.address != this.remoteaddr.address;
}

NatTraversal.prototype.refresh = function(){
  this.localaddr = this.socket.address();
  if(this.is_natted()) {
    console.log("NAT");
    // if not connected to STUN server: reconnect
    // request remoteaddr from STUN server
    
    var stunsrv = stun_server();
    console.log("Connecting to STUN server:");
    console.log(stunsrv);

    /*
    var sockfd = nsock.socket({
      node:      this.localaddr.address,
      service:   this.localaddr.port,
      socktype:  'SOCK_STREAM',
      bind:      true,
      reuseaddr: true,
      closeexec: true,
      nonblock:  true,
      protocol:  0
    });
    nsock.connect(sockfd, {
      node:     stunsrv.host,
      service:  stunsrv.port
    });
    var socket2 = new net.Socket({fd: sockfd});
    */

    var socket2 = net.connect({
      port: stunsrv.port,
      host: stunsrv.host,
      localAddress: this.localaddr.address,
      localPort: this.localaddr.port},
      function(){
        console.log(socket2.localAddress + ":" + socket2.localPort + " -> " +
                    socket2.remoteAddress + ":" + socket2.remotePort);

        stun.resolve(socket2, stunsrv, function(err, value) {
          if (err) {
            console.log('Something went wrong: ' + err);
            return;
          }
          console.log(value);
          socket2.close();
        });

      });
    
    tcp2udp(socket2, true);
    
    socket2.on('error', function(err){
      console.log('error');
      console.log(err);
    });
    
  } else {
    console.log("No NAT");
  }
}






var PublicTCP = function(cb){
  if(cb) this.on('refresh', cb);
}

PublicTCP.prototype = new events.EventEmitter;

PublicTCP.prototype.start = function(stunserver){
  if(typeof stunserver === 'string') stunserver = {host: stunserver};
  stunserver.port = stunserver.port || 3478;
  
  var self = this;
  var sock = this.socket = net.connect({port: stunserver.port, host: stunserver.host, localAddress: '192.168.0.95'},
    function(){
      stun.resolve_tcp(sock, stunserver, function(err, value) {
        if (err) {
          console.log('Something went wrong: ' + err);
        } else {
          console.log("STUN Response:")
          console.log(value);
          self.emit('refresh', value);
        }
      }, {short: false});
    });
}


PublicTCP.prototype.close = function(){
  this.emit('close');
  this.socket.end();
}

module.exports = {
  PublicTCP: PublicTCP,
  NatTraversal: NatTraversal
};

