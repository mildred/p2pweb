#!/usr/bin/env node

var net   = require('net');
var addon = require('sock');

//console.log(addon.hello());
//console.log(addon.socket('AF_INET', 'SOCK_STREAM')); // 'world'
var sockfd = addon.socket({node: '0.0.0.0', service: 100, socktype: 'SOCK_STREAM'})

var sock = new net.Socket({fd: sockfd})
sock.connect(1234);
console.log(sock);
