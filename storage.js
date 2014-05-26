var fs      = require('fs');
var path    = require('path');
var sha1sum = require('./sha1sum');

var filelist = {}
var addfile = function(file) {
  fs.stat(file, function(err, st){
    if(err) {
      console.log("Error " + file + ": " + err);
    } else if(st.isDirectory()) {
      fs.readdir(file, function(err, files){
        if (err) {
          console.log("Error " + file + ": " + err);
        } else {
          for(var i = 0; i < files.length; i++) {
            addfile(path.join(file, files[i]))
          }
        }
      });
    } else {
      fs.readFile(file, function (err, data) {
        if (err) {
          console.log("Error " + file + ": " + err);
        } else {
          var key = sha1sum(data);
          console.log("Add " + key + " " + file);
          filelist[key] = file;
        }
      });
    }
  });
}

module.exports = {
  addfile: addfile,
  filelist: filelist
}
