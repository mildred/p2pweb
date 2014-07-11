var $r = require('./r');
var mod = $r.module(module);

if(!mod || mod.engine !== 'r.js')
  throw new Error("loaded.js: doesn't work if not loaded with r.js");

mod.loaded = false;

var loaded = function(){
  console.log("loaded.js: Page is loaded");
  mod.loaded = true;
}

if(window.loaded) loaded();
else window.addEventListener('load', loaded);
