
module.exports = function(stream, callback){
  var dataList = [];

  stream.on('data', onData);
  stream.on('end', onEnd);
  stream.on('error', onError);
  
  function onData(chunk) {
    if(typeof chunk == "string") chunk = new Buffer(chunk);
    dataList.push(chunk);
  }
  
  function onEnd() {
    callback(null, Buffer.concat(dataList));
  }

  function onError(err) {
    stream.removeListener('data', onData);
    stream.removeListener('end', onData);
    stream.removeListener('error', onData);
    callback(err, Buffer.concat(dataList));
  }
};

