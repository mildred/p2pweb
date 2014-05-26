module.exports = function(sock, debug){

  sock.send = function(data, offset, length, port, host, callback){
    var sendData = data.slice(offset, offset + length);
    this.write(sendData);
    if(debug){
      console.log("TCP2UDP Send:");
      console.log(sendData);
    }
    if(callback) callback();
  };
  
  sock.on('data', function(data){
    var rinfo = {address: this.remoteAddress, port: this.remotePort};
    if(!this.concatData) this.concatData = data;
    else this.concatData = Buffer.concat([this.concatData, data]);
    while(this.concatData.length >= 4) {
      var len = this.concatData.readUInt16BE(2) + 20;
      if(this.concatData.length < len) break;
      var msg = this.concatData.slice(0, len);
      if(debug){
        console.log("TCP2UDP Message:");
        console.log(msg);
      }
      this.emit('message', msg, rinfo);
      this.concatData = this.concatData.slice(len);
    }
  });

  return sock;
}
