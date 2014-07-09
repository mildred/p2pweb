var $r = require('./r');
var mod = $r.module(module);

if(!mod || mod.engine !== 'r.js')
  throw new Error("loaded.js: doesn't work if not loaded with r.js");

mod.loaded = false;

if(window.loaded) loaded();
else window.addEventListener('load', loaded);

function loaded(){
  console.log("loaded.js: Page is loaded");
  mod.loaded = true;
}
