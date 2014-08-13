var fs      = require('fs');
var kad     = require('kademlia-dht');
var http    = require('http');
var random  = require('./random');
var express = require('express');
var verifysign = require('./verifysign');
var SignedHeader = require('./js/signedheader');

module.exports = function(server, kadrpc, storage){

  var app = express();

  app.get('/', function(req, res){
    res.sendfile(__dirname + "/index.html");
  });
  app.get('/style.css', function(req, res){
    res.sendfile(__dirname + "/style.css");
  });
  app.use('/js',           express.static(__dirname + '/js'));
  app.use('/js/tinymce',   express.static(__dirname + '/node_modules/tinymce'));
  app.use('/js/tinymce/skins/p2pweb',   express.static(__dirname + '/tinymce-skin-p2pweb'));
  app.use('/js/tinymce-dev/js/tinymce/skins/p2pweb',   express.static(__dirname + '/tinymce-skin-p2pweb'));
  app.use('/js/jsencrypt', express.static(__dirname + '/node_modules/jsencrypt/bin'));
  app.use('/js/jssha',     express.static(__dirname + '/node_modules/jssha/src'));
  app.use('/js/pure',      express.static(__dirname + '/node_modules/pure/libs'));
  app.use('/js/moment',    express.static(__dirname + '/node_modules/moment'));
  app.get('/tools-ws.html', function(req, res){
    res.sendfile(__dirname + "/tools-ws.html");
  });

  app.put('/obj/:fid', function(req, res){
    var fid = req.params.fid.toLowerCase();
    storage.putObjectHTTP(fid, req, function(code, title, message){
      res.setHeader("Content-Type", "text/plain");
      res.writeHead(code, title);
      res.end(message);
    });
  });

  var failDHTNotInitilized = function(res){
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(503, "Not Accessible");
    res.end("kadmelia not initialized, try again later.");
  };


  var failNotFound = function(res){
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(404, "Not Found");
    res.end("Resource not found.");
  };

  app.get("/rpc/seeds", function(req, res){
    if(!server.dht) return failDHTNotInitilized(res);

    res.setHeader("Content-Type", "text/plain");
    var seeds = server.dht.getSeeds();
    for(var i = 0; i < seeds.length; i++) {
      var seed = seeds[i];
      res.write(seed.id.toString() + "\t" + seed.endpoint + "\n");
    }
    res.end();
  });

  app.get("/rpc/cache", function(req, res){
    if(!server.dht) return failDHTNotInitilized(res);

    res.setHeader("Content-Type", "text/plain");
    var cache = server.dht.getCache();
    for(var k1 in cache) {
      var subcache = cache[k1];
      for(var k2 in subcache) {
        res.write(k1 + "\t" + k2 + "\n");
      }
    }
    res.end();
  });

  app.get("/rpc/cache.json", function(req, res){
    if(!server.dht) return failDHTNotInitilized(res);

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(server.dht.getCache()));
  });

  app.get("/rpc/cache/:k1.json", function(req, res){
    if(!server.dht) return failDHTNotInitilized(res);

    res.setHeader("Content-Type", "application/json");
    var cache = server.dht.getCache()[req.params.k1] || {};
    res.end(JSON.stringify(cache));
  });

  app.get("/rpc/cache/:k1/:k2.json", function(req, res){
    if(!server.dht) return failDHTNotInitilized(res);

    res.setHeader("Content-Type", "application/json");
    var cache = server.dht.getCache()[req.params.k1] || {};
    res.end(JSON.stringify(cache[req.params.k2] || null));
  });

  app.get("/rpc/storage/sites", function(req, res){
    res.setHeader("Content-Type", "text/plain");
    for(var k in storage.sitelist) {
      var f = storage.filelist[k];
      res.write(k);
      for(var i = 0; i < f.signed_ids.length; ++i) {
        res.write(i == 0 ? '\t' : ' ');
        res.write(f.signed_ids[i]);
      }
      for(var i = 0; i < f.extra_ids.length; ++i) {
        res.write(i == 0 ? '\t' : ' ');
        res.write(f.extra_ids[i]);
      }
      res.write('\n');
    }
    res.end();
  });

  app.get("/rpc/storage/objects", function(req, res){
    res.setHeader("Content-Type", "text/plain");
    for(var k in storage.filelist) {
      var f = storage.filelist[k];
      var meta = (f.source_id) ? {source_id: f.source_id} : f.metadata;
      res.write(k + "\t" + JSON.stringify(meta) + "\n");
    }
    res.end();
  });

  app.get("/rpc/storage/objects.html", function(req, res){
    res.setHeader("Content-Type", "text/html");
    res.write("<!DOCTYPE html5>\n<pre>");
    for(var k in storage.filelist) {
      var f = storage.filelist[k];
      var meta = (f.source_id) ? {source_id: f.source_id} : f.metadata;
      res.write("<a href=\"object/" + k + "\">" + k + "</a>" + "\t" + "<a href=\"object/" + k + ".json\">" + JSON.stringify(meta) + "</a>\n");
    }
    res.end("</pre>");
  });

  app.get("/rpc/storage/object/:fid.json", function(req, res){
    res.setHeader("Content-Type", "application/json");
    var f = storage.filelist[req.params.fid];
    if(!f) return failNotFound(res);
    res.end(JSON.stringify(f));
  });

  app.get("/rpc/storage/object/:fid", function(req, res){
    res.setHeader("Content-Type", "text/plain");
    var f = storage.filelist[req.params.fid];
    if(!f) return failNotFound(res);
    
    for(var i = 0; i < f.signed_ids.length; ++i){
      res.write(f.signed_ids[i] + "\n");
    }
    for(var i = 0; i < f.extra_ids.length; ++i){
      res.write(f.extra_ids[i] + " ?\n");
    }
    res.write("\n");
    for(var h in f.metadata.headers){
      res.write(h + ":\t" + f.metadata.headers[h] + "\n");
    }
    res.end();
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
    if(!server.dht) return failDHTNotInitilized(res);
    server.dht.getall(kad.Id.fromHex(fid), function(err, data){
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
        //console.log(server.dht._routes);
        //console.log(server.dht._routes.toString());
      } else {
        var availableDestinations = {};
        for(k in data) {
          if(!data[k].file_at) continue;
          var dest = data[k].file_at
          res.setHeader("X-Available-Location", dest)
          availableDestinations[k] = dest;
        }
        var destination = random.value(availableDestinations);
        //console.log(availableDestinations);
        //console.log(random.key(availableDestinations));
        kadrpc.getObject(destination, fid, 3, function(err, reply){
          if(err) {
            res.setHeader("Content-Type", "text/plain");
            res.writeHead(502, "Bad Gateway");
            res.end("Received error from node " + destination + ":\n" + err.toString());
          } else {
            for(h in reply.metadata.headers) {
              res.setHeader(h, reply.metadata.headers[h]);
            }
            console.log(reply);
            res.end(reply.data);
          }
        });
      }
    });
  };

  var serveFile = function(fid, res, query, opts){
    opts = opts || {}
    var file = storage.filelist[fid];
    if(file) {
      setHeaders(file.metadata);
      res.sendfile(file.path);
      return;
    }
    
    storage.getObject(server.dht, kadrpc, fid, function(err, data, metadata){
      if(err) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(err.httpStatus || 500, err.httpStatusText);
        res.end("Error:\n" + err);
        return;
      }
      if(!data) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404, "Not Found");
        res.end("File Not Found");
        return;
      }
      
      // FIXME: stream data instead of buffering it
      
      setHeaders(metadata);
      res.end(data);
    });
    
    function setHeaders(metadata){
      var heads = {};
      for(h in metadata.headers) {
        heads[h] = metadata.headers[h];
      }
      if(opts.headers) {
        for(h in opts.headers) {
          heads[h] = opts.headers[h];
        }
      }
      for(h in heads) {
        res.setHeader(h, heads[h]);
      }
      if(query['content-type']) res.setHeader('Content-Type', query['content-type']);
    }
  };

  app.get(/^\/obj\/([a-fA-F0-9]*)(,(\*|\+|[0-9]+))?(,[Ps]+)?(\/.*)?$/, function(req, res){
    var query_string = (/^[^\?]*(\?.*)$/.exec(req.url) || [])[1] || "";
    var fid = req.params[0].toLowerCase();
    var ver = req.params[2] || "";
    var flags = req.params[3] || "" // Should not contain A-F a-f
    var proxy    = flags.indexOf("P") != -1;
    var unsigned = flags.indexOf('s') != -1 || ver == '+';
    var path  = req.params[4];
    var cap = /\/~([a-fA-F0-9]*)(,(\*|\+|[0-9]+))?(,[s]+)?(\/.*)?$/.exec(path);
    if(cap) {
      if(cap[1] && cap[1].length > 0) {
        fid = cap[1].toLowerCase();
        ver = "";
      }
      if(cap[3] && cap[3].length > 0) {
        ver = cap[3];
      }
      flags = cap[4] || ""; 
      path = cap[5] || "";
      var newFlags = (proxy ? "P" : "") + (unsigned ? "s" : "") + flags;
      if(ver.length      > 0) ver      = "," + ver;
      if(newFlags.length > 0) newFlags = "," + newFlags;
      res.setHeader("Location", "/obj/" + fid + ver + newFlags + path + query_string);
      res.writeHead(302, "Found");
      res.end();
      return;
    }
    if(!path)
      return serveFile(fid, res, req.query, {query_string: query_string});
    
    storage.getSite(server.dht, kadrpc, fid, function(err, h, metadata){
      if(err) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(err.httpStatus || 500, err.httpStatusText);
        res.end("Error:\n" + err);
        return;
      }
      if(!h) {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404, "Not Found");
        res.end("File Not Found");
        return;
      }
      ver = parseInt(ver);
      if(!unsigned) {
        h.truncate();
        if(isNaN(ver)) ver = h.getLastSignedSection();
        res.setHeader("P2PWS-Display-Version", ver);
        res.setHeader("P2PWS-Version-Check", "signed");
      } else {
        res.setHeader("P2PWS-Display-Version", h.getLastUnsignedSection());
        res.setHeader("P2PWS-Version-Check", "none");
      }
      var f = h.getFile(path, isFinite(ver) ? ver : undefined);
      if(!f) {
        var ids = h.getSectionsIds();
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404, "Not Found");
        var displayVer   = isFinite(ver) ? ver
                         : unsigned      ? ids.length
                                         : (ids.length - 1);
        var displayVerId = unsigned      ? ids.last
                                         : ids[displayVer];
        var lastVer      = (ids.last == ids[ids.length - 1]) ? ids.length-1
                                                             : ids.length;
        res.end("Not Found: path not registered\n" +
          "Path: " + path + "\nWebsite: " + fid + "\n" +
          "Display Version:     #" + displayVer + " " + displayVerId + "\n" +
          "Last Signed Version: #" + (ids.length - 1) + " " + ids[ids.length-1] + "\n" +
          "Last Version:        #" + lastVer + " " + ids.last + "\n");
        return;
      }
      
      res.setHeader("P2PWS-Blob-Id", f.id);
      serveFile(f.id, res, req.query, {headers: f.headers, proxy: proxy, query_string: query_string});
    });
  });

  return app;
};

