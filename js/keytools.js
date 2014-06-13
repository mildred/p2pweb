

module.exports = {
  install_open_key_handler: function(button, callback){
    var file_opener = button.querySelector("input[type=file]");
    if(!file_opener) {
      button.insertAdjacentHTML('afterbegin', 
        '<input type="file" value="Open from file" style="display:none"/>');
      file_opener = button.querySelector("input[type=file]");
    }
    
    file_opener.addEventListener('change', function(){
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
    });
    
    button.addEventListener('click', function(){
      file_opener.click();
    });
  }
};

