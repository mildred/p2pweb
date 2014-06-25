//
// This file is part of Smoothie.
//
// Copyright (C) 2013,14 Torben Haase, Flowy Apps (torben@flowyapps.com)
//
// Smoothie is free software: you can redistribute it and/or modify it under the
// terms of the GNU Lesser General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option) any
// later version.
//
// Smoothie is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more
// details.You should have received a copy of the GNU Lesser General Public
// License along with Smoothie.  If not, see <http://www.gnu.org/licenses/>.
//
////////////////////////////////////////////////////////////////////////////////

// INFO Standalone require()
//      This is a stripped down standalone version of Smoothie's require
//      function, modified to execute the callback when all the modules are
//      recursively loaded.

(function(){

'use strict';

var RequireError = function(message, fileName, lineNumber) {
	this.name = "RequireError";
	this.message = message;
}
RequireError.prototype = Object.create(Error.prototype);

// NOTE Global module paths
var paths = window.Smoothie&&window.Smoothie.paths!==undefined?window.Smoothie.paths.slice(0):['./'];

// INFO Current module paths
//      path[0] contains the path of the currently loaded module, path[1]
//      contains the path its parent module and so on.

var pwd = Array('');

// INFO Pending callbacks

var cbstack = {};

// INFO Path parser
//      A HTMLAnchorElement parses its href property automatically, so we use
//      this functionality to parse our module paths instead of implemnting our
//      own.

var parser = document.createElement('A');

// INFO Module cache
//      Contains getter functions for the exports objects of all the loaded
//      modules. The getter for the module 'mymod' is name '$name' to prevent
//      collisions with predefined object properties (see note below).
//      As long as a module has not been loaded the getter is either undefined
//      or contains the module code as a function (in case the module has been
//      pre-laoded in a bundle).
// NOTE For IE8 the cache will be replaced by a HTMLDivElement-object later on,
//      since defineProperty is only supported for DOM objects there.

var cache = new Object();
var locks = new Object();

function debug(x){
  /*
  if(typeof x === "string") {
    console.log("require.js: " + x);
  } else {
    console.log("require.js:");
    console.log(x);
  }
  //*/
}

// INFO Module getter
//      Takes a module identifier, resolves it and gets the module code via an
//      AJAX request from the module URI. If this was successful the code and
//      some environment variables are passed to the load function. The return
//      value is the module's `exports` object. If the cache already
//      contains an object for the module id, this object is returned directly.
// NOTE If a callback function has been passed, the AJAX request is asynchronous
//      and the mpdule exports are passed to the callback function after the
//      module has been loaded.

function require(identifier, callback){
  
  // When require multiple modules
  if(identifier instanceof Array) {
    var global = this;
    var modules = [];
    var modules_left = identifier.length;
    for(var i = 0; i < identifier.length; i++){
      (function(idx, modname){
        modules.push(require(modname, function(mod){
          debug("In callback for module " + modname);
          modules[idx] = mod;
          modules_left--;
          if(modules_left == 0) {
            debug("callback for " + identifier.join(', ') + " starting");
            callback.apply(global, modules);
            debug("callback for " + identifier.join(', ') + " completed");
          }
        }));
      })(i, identifier[i]);
    }
    return modules;
  }

  var descriptor = resolve(identifier);
  var cacheid = '$'+descriptor.id;
  var frame = cbstack.last_frame;
  
  if (cache[cacheid]) {
    debug("Module already in cache: " + identifier);
    if(callback) {
      if(frame) {
        frame.on_require(identifier);
        cache[cacheid].onReady(function(){
          frame.on_load();
        });
      }
      cache[cacheid].onReady(callback);
      return;
    }
    if(!cache[cacheid].ready)
      throw new Error("Module " + identifier + " not ready, use a callback");
    return cache[cacheid].exports;
  }
  
  if(frame && callback) frame.on_require(identifier);
  
  debug(descriptor.uri + " loading");
  
  if(callback) get_script(descriptor, cacheid, load);
  else return load(get_script(descriptor, cacheid));
  
  function load(source){
    var module = cache[cacheid] = descriptor;
    module.exports = {};
    module.ready = false;
    module._readyCallbacks = [];
    
    var last_frame;
    var sub_frame = {
      num_requires: 1,
      on_require: function(mod){
        debug(module.uri + " require to " + mod + " detected");
        this.num_requires++;
      },
      on_wait: function(){
        debug(module.uri + " wait detected");
        this.num_requires++;
        this.explicit_wait = true;
      },
      on_ready: function(){
        this.num_requires = 0;
        module.ready = true;
        debug(module.uri + " notified ready, run callbacks");
        callback.apply(cache[cacheid], [cache[cacheid].exports]);
        var cb;
        while(cb = module._readyCallbacks.pop()) {
          cb.apply(cache[cacheid], [cache[cacheid].exports]);
        }
        if(this.parent) {
          debug(module.uri + " ready, notify parents");
          this.parent.on_load();
        }
        debug(module.uri + " callbacks completed");
      },
      on_load: function(){
        debug(module.uri + " notified for callback");
        this.num_requires--;
        if(this.num_requires == 0) {
          this.on_ready();
        } else {
          debug(module.uri + " not ready, waiting for " + this.num_requires);
        }
      },
      parent: frame
    };
    
    // Return a function that will mark the module as ready when called and not
    // before. Bypass other dependencies (?)
    module.wait = function(){
      sub_frame.on_wait();
      var ready = false;
      return function(){
        if(ready) return;
        sub_frame.on_ready();
        ready = true;
      };
    }
    
    // If the module is already in the cache, this function will take a callback
    // that will be called when the module is ready.
    module.onReady = function(callback) {
      if(module.ready) return callback.apply(cache[cacheid], [cache[cacheid].exports]);
      module._readyCallbacks.push(callback);
    };
    
    if(!callback){
      var f = new Function('global', 'module', 'exports', source + '\n//# sourceURL='+module.uri);
      setup();
      f.apply(module.exports, [window, module, module.exports]);
      teardown();
      debug(descriptor.uri + " loaded (sync)");
      return module.exports;
    }
    
    module._load_global_module_exports = function(f){
      setup();
      var res;
      try {
        res = f.apply(module.exports, [window, module, module.exports]);
      } finally {
        teardown();
      }
      module = cache[cacheid] = res.m;
      module.exports = res.e;
    };
    
    addCode('require.cache[' + JSON.stringify(cacheid) + ']._load_global_module_exports(function(global, module, exports){if(true){' + source + '\n} return {m:module, e:exports}; });\n//# sourceURL='+module.uri);
    
    debug(descriptor.uri + " loaded (async)");
    
    function setup(){
      debug(descriptor.uri + " initialize");
      last_frame = cbstack.last_frame;
      if(last_frame !== undefined) console.error(cbstack);
      cbstack.last_frame = sub_frame;
      pwd.unshift(module.id.match(/(?:.*\/)?/)[0]);
    }
    
    function teardown(){
      pwd.shift();
      cbstack.last_frame = last_frame;
      debug(descriptor.uri + " initialized");
      sub_frame.on_load();
    }
  
    function addCode(js, content_type){
      var e = document.createElement('script');
      e.type = 'text/javascript';
      e.src  = 'data:' + (content_type || 'text/javascript') + ','+escape(js);
      document.body.appendChild(e);
    }
  }
}

function get_script(descriptor, cacheid, callback){
  var request = new XMLHttpRequest();
  
  // NOTE IE8 doesn't support the onload event, therefore we use
  //      onreadystatechange as a fallback here. However, onreadystatechange
  //      shouldn't be used for all browsers, since at least mobile Safari
  //      seems to have an issue where onreadystatechange is called twice for
  //      readyState 4.
  if(callback) request[request.onload===null?'onload':'onreadystatechange'] = onLoad;
  request.open('GET', descriptor.uri, !!callback);
  // NOTE Sending the request causes the event loop to continue. Therefore
  //      pending AJAX load events for the same url might be executed before
  //      the synchronous onLoad is called. This should be no problem, but in
  //      Chrome the responseText of the sneaked in load events will be empty.
  //      Therefore we have to lock the loading while executong send().   
  locks[cacheid] = locks[cacheid]++||1;
  request.send();
  locks[cacheid]--;
  if(!callback) return onLoad();

  function onLoad() {
    if (request.readyState != 4)
      return;
    if (request.status != 200)
      throw new RequireError('unable to load '+descriptor.id+" ("+request.status+" "+request.statusText+")");
    if (locks[cacheid]) {
      console.warn("require.js: module locked: "+descriptor.id);
      callback && setTimeout(onLoad, 0);
      return;
    }
    if (!cache[cacheid]) {
      if(callback)
        callback(request.responseText);
      else
        return request.responseText;
    }
  }
}

// INFO Module resolver
//      Takes a module identifier and resolves it to a module id and URI. Both
//      values are returned as a module descriptor, which can be passed to
//      `fetch` to load a module.

function resolve(identifier) {
  // NOTE Matches [1]:[..]/[path/to/][file][.js]
  var m = identifier.match(/^(?:([^:\/]+):)?(\.\.?)?\/?((?:.*\/)?)([^\.]+)?(\..*)?$/);
  // NOTE Matches [1]:[/path/to]
  var p = pwd[0].match(/^(?:([^:\/]+):)?(.*)/);
  var root = m[2] ? paths[p[1]?parseInt(p[1]):0] : paths[m[1]?parseInt(m[1]):0];
  parser.href = (m[2]?root+p[2]+m[2]+'/':root)+m[3]+(m[4]?m[4]:'index');
  var id = parser.href.replace(/^[^:]*:\/\/[^\/]*\/|\/(?=\/)/g, '');
  var uri = "/"+id+(m[5]?m[5]:'.js');
  root.replace(/[^\/]+\//g, function(r) {
    id = (id.substr(0, r.length) == r) ?id.substr(r.length) : id = '../'+id;
  });
  return {'id':id,'uri':uri};
}

// INFO Load functions when page is loaded

var already_loaded = false;

function load(fun) {
  window.addEventListener('load', fun);
  if(already_loaded) setTimeout(fun, 0);
}

window.addEventListener('load', function(){
  already_loaded = true;
  window.loaded = true;
});

// INFO Exporting require to global scope

if (window.require !== undefined)
throw new SmoothieError('\'require\' already defined in global scope');

try {
  Object.defineProperty(window, 'require', {'value':require});
  Object.defineProperty(window.require, 'resolve', {'value':resolve});
  Object.defineProperty(window.require, 'load', {'value':load});
  Object.defineProperty(window.require, 'paths', {'get':function(){return paths.slice(0);}});
  Object.defineProperty(window.require, 'cache', {'get':function(){return cache;}});
}
catch (e) {
  // NOTE IE8 can't use defineProperty on non-DOM objects, so we have to fall
  //      back to unsave property assignments in this case.
  window.require = require;
  window.require.resolve = resolve;
  window.require.paths = paths.slice(0);
  window.require.cache = cache;
  // NOTE We definetly need a getter for the cache, so we make the the cache a
  //      DOM-object in IE8.
  cache = document.createElement('DIV');
}

// INFO Parsing module root paths

for (var i=0; i<paths.length; i++) {
  parser.href = paths[i];
  paths[i] = '/'+parser.href.replace(/^[^:]*:\/\/[^\/]*\/|\/(?=\/)/g, '');
}

})();
