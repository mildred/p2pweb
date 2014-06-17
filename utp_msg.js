var util = require('util');
var events = require('events');

// _ _ _ _  _ _ _ _  _ _ _ _  _ _ _ _
//                              ^ ^ ^__ 1: stream, 0: none
//                              | |____ 1: datagram, 0: none
//                              |______ FIN: signal end of stream or datagram

var FLAG_STREAM   = (1 << 0);
var FLAG_DGRAM    = (1 << 1);
var FLAG_FIN      = (1 << 2);
var HEADER_LENGTH = 8;
var CHUNK_MTU     = 1280 - 8; // IPv6 MTU - UDP

function split_chunks(buffer, chunk_size){
  var chunks = [];
  for(var i = 0, j = chunk_size; i < buffer.length; i = j, j += chunk_size) {
    chunks.push(buffer.slice(i, Math.min(j, buffer.length)));
  }
  return chunks;
}

function add_chunk_headers(chunks, baseFlags, id, callback) {
  for(var i = 0; i < chunks.length; i++) {
    var chunk  = chunks[i];
    var header = new Buffer(8);
    var end    = (baseFlags & FLAG_FIN) != 0 && i == (chunks.length - 1);
    var flags  = (baseFlags & (~FLAG_FIN)) | (end ? FLAG_FIN : 0);
    header.writeUInt16BE(flags,        0);
    header.writeUInt16BE(chunk.length, 2);
    header.writeUInt32BE(id,           4);
    chunk = Buffer.concat([header, chunk]);
    callback(chunk);
  }
}

function Stream(connection, id) {
  this.connection = connection;
  this.id = id;
  this.closed = false;
}
// Signal: data(buffer) - when stream data is received
// Signal: end()        - when the other end closed its stream

util.inherits(Stream, events.EventEmitter);

Stream.prototype.write = function(buffer, end){
  if(this.closed) throw new Error("Writing on a closed stream");
  if(!buffer) {
    buffer = new Buffer(0);
  } else if(! (buffer instanceof Buffer)) {
    buffer = new Buffer(buffer);
  }
  var chunks = split_chunks(buffer, CHUNK_MTU - HEADER_LENGTH);
  add_chunk_headers(chunks, FLAG_STREAM | (end ? FLAG_FIN : 0), this.id, function(chunk){
    this.closed = (chunk & FLAG_FIN) != 0;
    this.connection._underlyingStream.write(chunk);
  });
};

Stream.prototype.end = function(buffer){
  this.write(buffer, true);
};

Stream.prototype.close = function(){
  // stop receiving from this stream
  delete this.connection._streams[this.id];
  this.closed = true;
  this.emit('end');
};

function UTPMsg(stream, sub_id) {
  if(sub_id === undefined) {
    sub_id = stream;
    stream = undefined;
  }

  this._subId = sub_id;
  this._pendingData = null;
  this._pendingDatagrams = {};
  this._streams = {};
  this._underlyingStream = null;
  this._reservedIds = {};
  if(stream) this.setUnderlyingStream(stream);
}
// Signal: stream(stream_object) - when a new stream is initiated from the
//                                 other side
// Signal: data(id, buffer)      - when a datagram is received
// Signal: end()                 - when the session is closed

util.inherits(UTPMsg, events.EventEmitter);

UTPMsg.prototype.setUnderlyingStream = function(stream){
  this._underlyingStream = stream;
  var self = this;

  stream.on('error', function(err){
    self.emit('error', err);
  });

  stream.on('data', function(data){
    self.receiveData(data);
  });

  stream.on('end', function(){
    self.receiveEnd();
  });
}

UTPMsg.prototype.write = function(buffer, id, callback){
  var self = this;
  if(! (buffer instanceof Buffer)) {
    buffer = new Buffer(buffer);
  }
  if(typeof id == 'function') {
    callback = id;
    id = undefined;
  }
  id = this.generateId(id);
  if(callback) {
    // Reserve id until it has been replied to
    this._reservedIds[id] = true;
    this.once('datagram-' + id, function(data, _id){
      delete self._reservedIds[id];
      return callback(data, _id);
    });
  }
  var chunks = split_chunks(buffer, CHUNK_MTU - HEADER_LENGTH);
  add_chunk_headers(chunks, FLAG_DGRAM | FLAG_FIN, id, function(chunk){
    self._underlyingStream.write(chunk);
  });
};

UTPMsg.prototype.end = function() {
  this._underlyingStream.end();
};

UTPMsg.prototype.createStream = function(id){
  id = this.generateId(id);
  return this._streams[id] = new Stream(this, id);
};

UTPMsg.prototype.generateId = function(id){
  // one end should generate odd-only ids and the other end even-only ids
  while(!id || this._streams[id] || this._pendingDatagrams[id] || this._reservedIds[id]) {
    id = (((Math.random() * (1 << 16)) | 0) << 1) | this._subId;
  }
  return id;
};

UTPMsg.prototype.receiveData = function(data){
  if(this._pendingData) {
    this._pendingData = Buffer.concat([this._pendingData, data]);
  } else {
    this._pendingData = data;
  }

  if(this._pendingData.length < HEADER_LENGTH) return;
  
  var flags = this._pendingData.readUInt16BE(0);
  var len   = this._pendingData.readUInt16BE(2);
  var id    = this._pendingData.readUInt32BE(4);

  if(this._pendingData.length < HEADER_LENGTH + len) return;
  
  var subData = this._pendingData.slice(HEADER_LENGTH, HEADER_LENGTH + len);
  
  if((flags & FLAG_STREAM) != 0) {
    var stream = this._streams[id];

    if(!stream) {
      stream = this._streams[id] = new Stream(this, id);
      this.emit('stream', stream);
    }
    
    stream.emit('data', subData);
    
    if((flags & FLAG_FIN) != 0) {
      stream.emit('end');
      delete this._streams[id];
    }

  } else if((flags & FLAG_DGRAM) != 0) {
    var pendingData = this._pendingDatagrams[id];

    if(pendingData) {
      pendingData = Buffer.concat([pendingData, subData]);
      delete this._pendingDatagrams[id];
    } else {
      pendingData = subData;
    }

    if((flags & FLAG_FIN) != 0) {
      this.emit('data', pendingData, id);
      this.emit('datagram-' + id, pendingData, id);
    } else {
      this._pendingDatagrams[id] = pendingData;
    }
  } else {
    console.log("RAWUTP: received null message");
  }
};

UTPMsg.prototype.receiveEnd = function() {
  for (var id in this._streams) {
    this._streams[id].emit('end');
  }
  this.emit('end');
};

module.exports = UTPMsg;
