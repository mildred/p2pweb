NodeList.prototype.show = function(show){
  for(var i = 0; i < this.length; i++){
    var e = this[i];
    if(show === undefined || show){
      e.style.display = e._display ? e._display : null;
    } else if (e.style.display != 'none') {
      e._display = e.style.display;
      e.style.display = 'none';
    }
  }
}
NodeList.prototype.hide = function(){
  this.show(false);
}
