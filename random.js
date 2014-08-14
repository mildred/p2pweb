module.exports.int = function (low, high) {
  return Math.floor(Math.random() * (high - low) + low);
}

module.exports.key = function (array) {
  var keys = Object.keys(array);
  var key  = module.exports.int(0, keys.length);
  return keys[key];
}

module.exports.value = function (array) {
  return array[module.exports.key(array)];
}

module.exports.shuffle = function(array) {
  var currentIndex = array.length;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    var randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    var tmp = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = tmp;
  }

  return array;
}
