var fs      = require('fs');
var express = require('express');
var sockets = require('./sockets');
var storage = require('./storage');
var sha1sum = require('./sha1sum');
var kadwsrpc = require('./kadwsrpc');
var verifysign = require('./verifysign');
var SignedHeader = require('./js/signedheader');

var app = express();
var websock = new sockets.server();
var kadrpc = new kadwsrpc();
var dht;

var randomInt = function (low, high) {
  return Math.floor(Math.random() * (high - low) + low);
}

var randomKey = function (array) {
  var keys = Object.keys(array);
  var key  = randomInt(0, keys.length);
  return keys[key];
}

var randomValue = function (array) {
  return array[randomKey(array)];
}


app.get('/', function(req, res){
  res.sendfile(__dirname + "/index.html");
});
app.get('/style.css', function(req, res){
  res.sendfile(__dirname + "/style.css");
});
app.use('/js',           express.static(__dirname + '/js'));
app.use('/js/tinymce',   express.static(__dirname + '/node_modules/tinymce'));
app.use('/js/jsencrypt', express.static(__dirname + '/node_modules/jsencrypt/bin'));
app.use('/js/jssha',     express.static(__dirname + '/node_modules/jssha/src'));
app.get('/tools-ws.html', function(req, res){
  res.sendfile(__dirname + "/tools-ws.html");
});

app.put('/obj/:fid', function(req, res){
  var fid = req.params.fid.toLowerCase();
  storage.create(fid, req, function(code, title, message){
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(code, title);
    res.end(message);
  });
});

var redirectObjectNotFound = function(fid, path, res) {
  res.setHeader("X-File-ID", fid)
  if(path != "") res.setHeader("X-File-Path", path)
  if(!dht) {
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(503, "Not Accessible");
    res.end("kadmelia not initialized, try again later.");
  } else {
    dht.getall(fid, function(err, data){
      if(err) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(500, "Internal Server Error");
        res.write("Error:\n" + err);
      } else if(data === undefined) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404, "Not Found");
        res.write("Not Found: no contact to provide the data");
        console.log(dht._routes);
        console.log(dht._routes.toString());
      } else {
        var availableDestinations = {};
        for(k in data) {
          if(!data[k].file_at) continue;
          var dest = data[k].file_at
          res.setHeader("X-Available-Location", "http://" + dest[0] + ":" + dest[1] + "/obj/" + fid + path)
          availableDestinations[k] = dest;
        }
        console.log(availableDestinations);
        var destination = randomValue(availableDestinations);
        console.log(randomKey(availableDestinations));
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Location", "http://" + destination[0] + ":" + destination[1] + "/obj/" + fid + path);
        res.writeHead(302, "Found");
      }
      res.end();
    });
  }
};

var serveFile = function(fid, res, headers){
  var file = storage.filelist[fid];
  if(file) {
    var heads = {};
    for(h in file.metadata.headers) {
      heads[h] = file.metadata.headers[h];
    }
    if(headers) {
      for(h in headers) {
        heads[h] = headers[h];
      }
    }
    for(h in heads) {
      res.setHeader(h, heads[h]);
    }
    res.sendfile(file.path);
  } else {
    redirectObjectNotFound(fid, "", res)
  }  
};

app.get(/^\/obj\/([a-fA-F0-9]*)$/, function(req, res){
  var fid = req.params[0].toLowerCase();
  serveFile(fid, res);
});

app.get(/^\/obj\/([a-fA-F0-9]*)(,(\*|\+|[0-9]*))?(\/.*)$/, function(req, res){
  var fid = req.params[0].toLowerCase();
  var ver = req.params[2];
  var path = req.params[3];
  var file = storage.filelist[fid];
  if(file) {
    fs.readFile(file.path, function (err, data) {
      if(err) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(500, "Internal Server Error");
        res.write("Error:\n" + err);
        return;
      }
      var h = new SignedHeader(verifysign);
      h.parseText(data.toString());
      if(ver != '+') {
        h.checkHeaders();
      }
      ver = parseInt(ver);
      var f = h.getFile(path, isNaN(ver) ? undefined : ver);
      if(f) {
        serveFile(f.id, res, f.headers);
      } else {
        var ids = h.getSectionsIds(sha1sum);
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404, "Not Found");
        res.end("Not Found: path not registered\nPath: " + path + "\nWebsite: " + fid + "\nVersion: #" + (ids.length - 1) + " " + ids[ids.length-1] + "\n");
      }
    });
  } else {
    redirectObjectNotFound(fid, path, res)
  }
})

websock.connect('/ws/control', function(request, socket){
  socket.on('message', function(message) {
    var data = JSON.parse(message.utf8Data || message.binaryData);
    console.log(data);
    socket.send(JSON.stringify(data));
  });
});

websock.connect('/ws/kad', function(request, socket){
  kadrpc.websocket_receive(request, socket);
});

module.exports = {
  kadrpc: kadrpc,
  app: app,
  websock: websock,
  storage: storage,
  init: function(datadir) {
    datadir = datadir || (__dirname + '/data');
    storage.setDataDir(datadir);
    storage.addfile(datadir);
  },
  initDHT: function(dht_){
    dht = dht_;
  }
};

