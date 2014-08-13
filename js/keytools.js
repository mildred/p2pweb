var saveAs = require('./filesaver/FileSaver');

module.exports.generate_file_opener = function(button, callback){
  return function(){
    var file_opener = button.querySelector("input[type=file]");
    if(!file_opener) {
      button.insertAdjacentHTML('afterbegin', 
        '<input type="file" value="Open from file" style="display:none"/>');
      file_opener = button.querySelector("input[type=file]");
    } else {
      file_opener.outerHTML = '<input type="file" value="Open from file" style="display:none"/>';
    }
    
    file_opener.addEventListener('change', onChange);
    file_opener.addEventListener('click', function(event){
      event.stopPropagation(); // avoid triggering the outer button
    });
    
    function onChange(){
      var files = file_opener.files;
      if(files.length != 1) {
        return callback('No private key file');
      }

      var reader = new FileReader();
      reader.onload = function(event) {
        var content = event.target.result;
        var crypt = new JSEncrypt();
        crypt.setKey(content);
        if(crypt.key.hasPrivateKeyProperty(crypt.key)) {
          return callback(null, crypt.getPrivateKey(), crypt);
        } else {
          return callback(null, null, crypt);
        }
      };
      reader.onerror = function(event) {
        return callback(event.target.error);
      };
      reader.readAsText(files[0]);
    }
    
    file_opener.click();
  };
};

module.exports.install_file_opener = function(button){
  var callback;
  var file_opener = button.querySelector("input[type=file]");
  if(!file_opener) {
    button.insertAdjacentHTML('afterbegin', 
      '<input type="file" value="Open from file" style="display:none"/>');
    file_opener = button.querySelector("input[type=file]");
  } else {
    file_opener.outerHTML = '<input type="file" value="Open from file" style="display:none"/>';
  }
  
  file_opener.addEventListener('change', onChange);
  
  function onChange(){
    var files = file_opener.files;
    if(files.length != 1) {
      return callback('No private key file');
    }

    var reader = new FileReader();
    reader.onload = function(event) {
      var content = event.target.result;
      var crypt = new JSEncrypt();
      crypt.setKey(content);
      if(crypt.key.hasPrivateKeyProperty(crypt.key)) {
        return callback(null, crypt.getPrivateKey(), crypt);
      } else {
        return callback(null, null, crypt);
      }
    };
    reader.onerror = function(event) {
      return callback(event.target.error);
    };
    reader.readAsText(files[0]);
  }
  
  return function(cb){
    callback = cb;
    file_opener.click();
  };
};

module.exports.install_open_key_handler = function(button, callback){
  var opener = module.exports.install_file_opener(button);
  button.addEventListener('click', onClick);
  function onClick(){
    opener(callback);
  }
};
  
module.exports.save_private_crypt_handler = function(crypt, callback) {
  var blob = new Blob([crypt.getPrivateKey()], {type: "application/x-pem-file"});
  saveAs(blob, "private.pem");
  if(callback) callback();
};
  
module.exports.generate_private_crypt_handler = function(keylen, callback){
  if(callback === undefined) {
    callback = keylen;
    keylen = undefined;
  }
  keylen = keylen || 4096;
  return function () {
    var crypt = this.crypt = new JSEncrypt({default_key_size: keylen});
    var dt = new Date();
    var time = -(dt.getTime());
    var textFeedback = 'Generating ' + keylen + ' bytes key.';
    callback(textFeedback, null);
    var load = setInterval(function () {
      textFeedback = textFeedback.replace('...', '');
      textFeedback += '.';
      callback(textFeedback, null);
    }, 500);
    crypt.getKey(function () {
      clearInterval(load);
      textFeedback = "Generated";
      dt = new Date();
      time += (dt.getTime());
      if(time > 1000)
        callback('Generated in ' + (time / 1000) + ' s', crypt);
      else
        callback('Generated in ' + time + ' ms', crypt);
    });
  };
};


