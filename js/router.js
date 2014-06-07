function Router(){
  console.log(window);
  var self = this;
  this._routes = [];
  this._router = function(){
    var h = window.location.hash;
    var c = /^\#\!(\/.*)$/.exec(h);
    if(c) {
      var p = c[1];
      var params = {
        hash: h,
        path: p
      };
      for(var i = 0; i < self._routes.length; i++) {
        var r = self._routes[i];
        if(typeof r.matcher === 'string' && r.matcher == p) {
          console.log("Routing to " + p);
          r.callback.apply(self, [params]);
          return;
        } else if (r.matcher.exec) {
          var c = r.matcher.exec(p);
          if(c) {
            console.log("Routing to " + r.matcher.toString());
            c.hash = h;
            c.path = p;
            r.callback.apply(self, [c]);
            return;
          }
        }
      }
    }
    console.warn("Failed to route to " + p);
    if(self._fallback) {
      self._fallback.apply(self, [params]);
    }
  };
};

Router.prototype.on = function(matcher, callback){
  this._routes.push({matcher: matcher, callback: callback});
}

Router.prototype.fallback = function(callback){
  this._fallback = callback;
}

Router.prototype.run = function(){
  window.addEventListener('load',       this._router);
  window.addEventListener('hashchange', this._router);
  if(window.loaded) this._router();
}

module.exports = Router;

