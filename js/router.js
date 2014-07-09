function Router(win){
  this._window = win || window;
  this._window.router = this;
  var self = this;
  this._routes = [];
  this._router = function(){
    var h = self._window.location.hash;
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
  console.log("router.js: run");
  this._window.addEventListener('load',       this._router);
  this._window.addEventListener('hashchange', this._router);
  if(this._window.loaded) this._router();
}

Router.prototype.go = function(location) {
  console.log("Router: go to " + location);
  if(this._window.location.hash == location) {
    console.log("Router: (run _router())");
    this._router();
  } else {
    this._window.location = location;
  };
}

module.exports = Router;

