
require('./loaded');
var $p = require('./pure/pure').$p;

function template(selector, directives) {
  var p = $p(selector);
  var template = p.compile(directives);
  template.push = function(data){
    window.document.querySelector(selector).outerHTML = template(data);
  }
  return template;
}

exports.status = {}

exports.status.public_addr = template("#section-status .public-addr", {
  ".address":        "address",
  ".remote-address": "remote_address",
  "time@datetime":   "date",
  "time":            "dateFromNow"
});

exports.status.seeds = template("#section-status .seeds", {
  ".seed": {
    "seed<-seeds": {
      ".seed-id":     "seed.id",
      ".seed-url":    "seed.endpoint",
      ".remove@href": "#!/status/seed/#{seed.id}/remove"
    }
  }
});

