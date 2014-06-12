var fs      = require('fs');
var http    = require('http');
var express = require('express');
var sockets = require('./sockets');
var storage = require('./storage');
var sha1sum = require('./sha1sum');
var KadWsRpc = require('./kadwsrpc');
var KadHttpRpc = require('./kadhttprpc');
var verifysign = require('./verifysign');
var SignedHeader = require('./js/signedheader');

var app = express();
var websock = new sockets.server();
var kadwsrpc = new KadWsRpc();
var kadhttprpc = new KadHttpRpc();
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
app.use('/js/pure',      express.static(__dirname + '/node_modules/pure/libs'));
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

app.post("/rpc/kad", function(res, req){
  kadhttprpc.handle_request(res, req);
});

var proxyFile = function(res2, options){
  var req = http.request(options, function(res){
    if(res.headers['content-type'])
      res2.setHeader("Content-Type", res.headers['content-type']);
    res2.writeHead(res.statusCode, res.statusMessage);
    res.on('data', function(chunk) {
      res2.write(chunk);
    })
    res.on('end', function() {
      res2.end();
    });
  });
  req.on('error', function(e){
    console.log(e);
  });
  req.end();
}

var redirectObjectNotFound = function(fid, path, res, opts) {
  opts = opts || {};
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
        res.end();
      } else if(data === undefined) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404, "Not Found");
        res.write("Not Found: no contact to provide the data");
        res.end();
        //console.log(dht._routes);
        //console.log(dht._routes.toString());
      } else {
        var availableDestinations = {};
        for(k in data) {
          if(!data[k].file_at) continue;
          var dest = data[k].file_at
          res.setHeader("X-Available-Location", "http://" + dest[0] + ":" + dest[1] + "/obj/" + fid + path)
          availableDestinations[k] = dest;
        }
        var destination = randomValue(availableDestinations);
        //console.log(availableDestinations);
        //console.log(randomKey(availableDestinations));
        if(opts.proxy) {
          proxyFile(res, {
            host:   destination[0],
            port:   destination[1],
            path:   "/obj/" + fid + path,
            method: 'GET'
          });
        } else {
          res.setHeader("Location", "http://" + destination[0] + ":" + destination[1] + "/obj/" + fid + path);
          res.writeHead(302, "Found");
          res.end();
        }
      }
    });
  }
};

var serveFile = function(fid, res, headers, opts){
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
    redirectObjectNotFound(fid, "", res, opts)
  }  
};

app.get(/^\/obj\/([a-fA-F0-9]*)$/, function(req, res){
  var fid = req.params[0].toLowerCase();
  serveFile(fid, res);
});

app.get(/^\/obj\/([a-fA-F0-9]*)(,(\*|\+|[0-9]+))?(,[P]+)?(\/.*)$/, function(req, res){
  var fid = req.params[0].toLowerCase();
  var ver = req.params[2] || "";
  var flags = req.params[3] || "" // Should not contain A-F a-f
  var proxy = flags.indexOf("P") != -1;
  var path  = req.params[4];
  var cap = /\/~([a-fA-F0-9]*)(,(\*|\+|[0-9]+))?(\/.*)$/.exec(path);
  if(cap) {
    if(cap[1] && cap[1].length > 0) {
      fid = cap[1].toLowerCase();
    }
    if(cap[3] && cap[3].length > 0) {
      ver = cap[3];
    }
    path = cap[4];
    var newFlags = (proxy ? "P" : "");
    if(ver.length      > 0) ver      = "," + ver;
    if(newFlags.length > 0) newFlags = "," + newFlags;
    res.setHeader("Location", "/obj/" + fid + ver + newFlags + path);
    res.writeHead(302, "Found");
    res.end();
    return;
  }
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
        ver = parseInt(ver);
        if(isNaN(ver)) ver = h.getLastSignedSection();
        res.setHeader("P2PWS-Display-Version", ver);
        res.setHeader("P2PWS-Version-Check", "signed");
      } else {
        res.setHeader("P2PWS-Display-Version", h.getLastUnsignedSection());
        res.setHeader("P2PWS-Version-Check", "none");
      }
      var f = h.getFile(path, isFinite(ver) ? ver : undefined);
      if(f) {
        res.setHeader("P2PWS-Blob-Id", f.id);
        serveFile(f.id, res, f.headers, {proxy: proxy});
      } else {
        var ids = h.getSectionsIds(sha1sum);
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404, "Not Found");
        var displayVer   = isFinite(ver) ? ver :
                           (ver == '+')  ? ids.length : (ids.length - 1);
        var displayVerId = ver == '+' ? ids.last : ids[displayVer];
        var lastVer      = (ids.last == ids[ids.length - 1]) ? ids.length-1 : ids.length;
        res.end("Not Found: path not registered\nPath: " + path + "\nWebsite: " + fid + "\nDisplay Version:     #" + displayVer + " " + displayVerId + "\nLast Signed Version: #" + (ids.length - 1) + " " + ids[ids.length-1] + "\nLast Version:        #" + lastVer + " " + ids.last + "\n");
      }
    });
  } else {
    redirectObjectNotFound(fid, path, res, {proxy: proxy})
  }
});

websock.connect('/ws/control', function(request, socket){
  socket.on('message', function(message) {
    var data = JSON.parse(message.utf8Data || message.binaryData);
    console.log(data);
    socket.send(JSON.stringify(data));
  });
});

websock.connect('/ws/kad', function(request, socket){
  kadwsrpc.websocket_receive(request, socket);
});

module.exports = {
  kadrpc: kadhttprpc,
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

