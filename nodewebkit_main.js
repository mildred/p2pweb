var template = require("./js/ui/template");   // r.js
var server   = global.require("./server"); // nodejs
var moment   = global.require("./js/moment/min/moment-with-locales.min.js")
var nodeapi  = global.require("./nodewebkit_api");
var path     = global.require("path");
var mkdirp   = global.require("mkdirp");
var nw_gui   = window.require('nw.gui');
var env      = process.env;

window.addEventListener('beforeunload', function(e) {
  console.log(e.target);
  console.log(e.cancelable);
  e.preventDefault();
  e.stopPropagation();
});

var xdg_data_dirs = (env.XDG_DATA_DIRS || "").split(":");
var xdg_data_home = (env.XDG_DATA_HOME || env.HOME + "/.local/share")

console.log("nodewebkit_main.js");

var srv = new server();
srv.setPort(undefined);
for(var i = 0; i < xdg_data_dirs.length; i++){
  if(xdg_data_dirs[i].length == 0) continue;
  srv.addDataDir(path.join(xdg_data_dirs[i], "p2pweb", "data"));
}
var datadir = path.join(xdg_data_home, "p2pweb", "data");
mkdirp(datadir);
srv.setDataDir(datadir);
module.exports = nodeapi(srv);

var update_nodes_handler;
window.document.addEventListener("template-push", function(e){
  if(update_nodes_handler) update_nodes_handler(e.target);
});
  
srv.on('listening', function(port) {
  template.status.listening_port.push({port: port});
  
  update_nodes_handler = function(node){
    var links = node.querySelectorAll("a.external, a.internal-popup");
    for(var i = 0; i < links.length; i++){
      var lnk = links[i];
      lnk.addEventListener('click', function(e){
        var href = this.getAttribute('href');
        if(href[0] == '/')
          href = "http://localhost:" + port + href
        nw_gui.Shell.openExternal(href);
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    }
  }
  update_nodes_handler(window.document);
});

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

module.loaded = false;
srv.start(function(){
  module.loaded = true;
});

function updateStatus() {
  if(!srv.dht) return;

  var seeds = srv.dht.getSeeds();
  template.status.seeds.push({
    seeds: seeds
  });
  
  var datalist  = srv.storage.getCacheFileList();
  var datalistr = datalist.filter(function(item){
    return Object.keys(item.depends).length == 0;
  }).map(fillRelations);
  
  function fillRelations(item){
    item.rel = {};
    item.relations = [];
    for(subid in item.rdepends) {
      var relation = item.rdepends[subid];
      var subitem = datalist[subid];
      if(!subitem) {
        subitem = {id: subid, missing: true};
      }
      if(!item.rel[relation]) {
        var rel = {relation: relation, children: []};
        item.rel[relation] = rel;
        item.relations.push(rel);
      }
      item.rel[relation].children.push(fillRelations(subitem));
    }
    return item;
  }

  template.status.data.push({
    data: datalistr
  });
};

updateStatus();
setInterval(updateStatus, 1000);
