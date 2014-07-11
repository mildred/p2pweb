var template = require("./js/template");   // r.js
var server   = global.require("./server"); // nodejs
var moment   = global.require("./js/moment/min/moment-with-langs.min.js")
var nodeapi  = global.require("./nodewebkit_api");

console.log("nodewebkit_main.js");

var srv = new server();
module.exports = nodeapi(srv);

srv.on("public-address", function(address, remote_address){
  var now = moment();
  template.status.public_addr.push({
    address:        address,
    remote_address: remote_address,
    date:           now.format(),
    dateFromNow:    now.fromNow()
  });
});

var new_seed_input  = window.document.querySelector("#section-status .new-seed input[type=text]");
var new_seed_button = window.document.querySelector("#section-status .new-seed input[type=button]");
new_seed_button.addEventListener('click', function(){
  srv.addSeed(new_seed_input.value);
});

srv.start();

function updateSeeds() {
  if(!srv.dht) return;
  var seeds = srv.dht.getSeeds();
  template.status.seeds.push({
    seeds: seeds
  });
};

updateSeeds();
setInterval(updateSeeds, 1000);
