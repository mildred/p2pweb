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
