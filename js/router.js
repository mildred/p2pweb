function Router(){
  console.log(window);
  var self = this;
  this._router = function(){
    var h = window.location.hash;
    var c = /^\#\!(\/.*)$/.exec(h);
    if(!c) return;
    var p = c[1];
    if(self[p]) {
      console.log("Routing to " + p);
      self[p](h, p);
    } else {
      console.warn("Failed to route to " + p);
    }
  };
};

Router.prototype.run = function(){
  window.addEventListener('load',       this._router);
  window.addEventListener('hashchange', this._router);
  if(window.loaded) this._router();
}

module.exports = Router;

