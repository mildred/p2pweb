#!/usr/bin/env node

var net   = require('net');
var natt  = require('./nattraversal');

var tcp = new natt.PublicTCP();
tcp.on('refresh', function(data){

  sock = net.createServer(function(c){});
  sock.listen(data.local.port, data.local.host);
  
  console.log("Local listening socket:");
  console.log(sock.address());

  setTimeout(function(){
    console.log("timeout");
    tcp.close();
    //setTimeout(function(){}, 100000);
  }, 5000);
  
  tcp.on('close', function(){
    sock.close();
  });

});

//tcp.start("stun.stunprotocol.org");
//tcp.start("stunserver.org");
//tcp.start('provserver.televolution.net');
//tcp.start('stun.ipshka.com');
tcp.start("perrin.mildred.fr");


