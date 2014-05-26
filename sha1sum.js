var crypto = require('crypto');

module.exports = function(data) {
  var sum = crypto.createHash('sha1');
  sum.update(data);
  return sum.digest('hex');
};
