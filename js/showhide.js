Node.prototype.show = function(show){
  if(show === undefined || show){
    this.style.display = this._display ? this._display : null;
  } else if (this.style.display != 'none') {
    this._display = this.style.display;
    this.style.display = 'none';
  }
}

Node.prototype.hide = function(){
  this.show(false);
}

NodeList.prototype.show = function(show){
  for(var i = 0; i < this.length; i++){
    this[i].show(show);
  }
}

NodeList.prototype.hide = function(){
  this.show(false);
}
