/*
window.addEventListener('load', function(){

  // showhide

  var links = document.querySelectorAll("a.showhide");
  for(var i = 0; i < links.length; ++i){
    links[i].addEventListener('click', function(){
      var target = document.querySelector(this.getAttribute('href'));
      var siblings = target.parentElement.children;
      for(var i = 0; i < siblings.length; ++i){
        if(siblings[i] == target) continue;
        if(siblings[i].tagName != 'SECTION') continue;
        if(!siblings[i].classList.contains('showhide')) continue;
        siblings[i].style.display = 'none';
      }
      target.style.display = 'block';
      return false;
    });
  }
  
  var sections = document.querySelectorAll("section.showhide");
  for(var i = 0; i < sections.length; ++i){
    sections[i].style.display = 'none';
  }
});
*/

window.Router = function Router(){
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
  window.addEventListener('load',       this._router);
  window.addEventListener('hashchange', this._router);
};

