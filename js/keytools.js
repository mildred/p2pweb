var ready = module.wait();
require(['./filesaver/FileSaver'], function(saveAs){

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
    },
    
    save_private_crypt_handler: function(crypt, callback) {
      var blob = new Blob([crypt.getPrivateKey()], {type: "application/x-pem-file"});
      saveAs(blob, "private.pem");
      if(callback) callback();
    },
    
    generate_private_crypt_handler: function(feedback, callback){
      return function () {
        var dt = new Date();
        var time = -(dt.getTime());
        var textFeedback = 'Generating.';
        feedback(textFeedback);
        var load = setInterval(function () {
          textFeedback += '.';
          feedback(textFeedback);
        }, 500);
        crypt.getKey(function () {
          clearInterval(load);
          dt = new Date();
          time += (dt.getTime());
          if(time > 1000)
            feedback('Generated in ' + (time / 1000) + ' s');
          else
            feedback('Generated in ' + time + ' ms');
          callback(crypt);
        });
      };
    }
  };
  
  ready(); // FIXME: should not be necessary

});

