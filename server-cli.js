#!/usr/bin/env node

var server = require('./server');

var srv = new server();

if(exports.parsed) return;
exports.parsed = true;
for(var i = 2; i < process.argv.length; i++){
  var arg = process.argv[i];
  if(arg == "-port") {
    srv.setPort(parseInt(process.argv[++i]));
  } else if(arg == "-data") {
    srv.setDataDir(process.argv[++i]);
  } else if(arg == "-seedlist") {
    throw new Error("-seedlist not implemented");
  } else if(arg == "-seed") {
    srv.addSeed(process.argv[++i]);
  } else if(parseInt(arg)) {
    srv.setPort(parseInt(arg));
  } else {
    if(arg != "-help") console.log("Unknown argument " + arg);
    console.log(process.argv[1] + " [-port PORTNUM] [-data DATADIR] [-seed URL] [-seedlist FILE] [PORTNUM]");
    console.log(process.argv[1] + " -help");
    return;
  }
}

srv.start();

