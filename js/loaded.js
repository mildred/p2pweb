module.loaded = false;
require.onload(function(){
  console.log("loaded.js: Page is loaded");
  module.loaded = true;
});
