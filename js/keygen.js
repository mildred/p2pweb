window.KeyGen = function(ui, keylen){
  var crypt = this.crypt = new JSEncrypt({default_key_size: keylen || 4096});
  var self = this;

  window.addEventListener('load', function(){
  
    var privkeysection = ui || document.querySelector(".privkey");
    var btn_generate   = privkeysection.querySelector("button.btn-generate");
    var btn_open       = privkeysection.querySelector("button.btn-open");
    var btn_save       = privkeysection.querySelector("button.btn-save");
    var file_opener    = privkeysection.querySelector("input[type=file]");
    var label          = privkeysection.querySelector("span");
    
    btn_save.disabled = true;
    self.has_key = false;
      
    var generateKeys = function () {
      btn_generate.disabled = true;
      btn_open.disabled = true;
      var dt = new Date();
      var time = -(dt.getTime());
      label.textContent = 'Generating.';
      var load = setInterval(function () {
        label.textContent += '.';
      }, 500);
      crypt.getKey(function () {
        clearInterval(load);
        dt = new Date();
        time += (dt.getTime());
        if(time > 1000)
          label.textContent = 'Generated in ' + (time / 1000) + ' s';
        else
          label.textContent = 'Generated in ' + time + ' ms';
        privkey = crypt.getPrivateKey();
        pubkey  = crypt.getPublicKey();
        btn_generate.disabled = false;
        btn_open.disabled = false;
        btn_save.disabled = false;
        self.has_key = true;
      });
    };
    
    var loadFile = function() {
      btn_generate.disabled = true;
      btn_open.disabled = true;
      file_opener.click();
    };
    
    var loadedFile = function() {
      var files = file_opener.files;
      btn_generate.disabled = false;
      btn_open.disabled = false;
      if(files.length != 1) {
        label.textContent = 'No private key file';
        return;
      }

      var reader = new FileReader();
      reader.onload = function(event) {
        var content = event.target.result;
        crypt.setKey(content);
        if(crypt.key.hasPublicKeyProperty(crypt.key) && crypt.key.hasPrivateKeyProperty(crypt.key)) {
          //var sign = crypt.sign("test", sha1hex)
          label.textContent = 'Opened private key';
          btn_save.disabled = false;
          self.has_key = true;
          if(self.onkey) self.onkey(crypt);
        } else {
          label.textContent = 'Failed to load private key';
          alert("Could not load private key");
        }
      };
      reader.onerror = function(event) {
        label.textContent = 'Failed to read private key file';
        alert("File could not be read! Code " + event.target.error.code);
      };
      reader.readAsText(files[0]);
    };
    
    var saveFile = function() {
      var blob = new Blob([crypt.getPrivateKey()], {type: "application/x-pem-file"});
      saveAs(blob, "private.pem");
    }
    
    btn_generate.addEventListener('click', generateKeys);
    btn_open.addEventListener('click', loadFile);
    btn_save.addEventListener('click', saveFile);
    file_opener.addEventListener('change', loadedFile);

  });
}
