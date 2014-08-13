
require('./../loaded');
var $p = require('./../pure/pure').$p;

function template(selector, directives) {
  var p = $p(selector);
  var template = p.compile(directives);
  template.push = function(data){
    window.document.querySelector(selector).outerHTML = template(data);
    var event = new Event('template-push', {bubbles: true});
    window.document.querySelector(selector).dispatchEvent(event);
  };
  return template;
}

exports.status = {};
exports.open_website = {};

exports.status.listening_port = template("#section-status .listening-port", {
  ".port": "port"
});

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

exports.status.data = template("#section-status .data-list", {
  ".data": {
    "d<-data": {
      ".data-id": "d.id",
      "a.lnk-view@href": "/obj/#{d.id}",
      "a.lnk-view-source@href": "/obj/#{d.id}?content-type=text/plain",
      "@class+": function(ctxt){
        return (ctxt.d.item.missing ? " missing" : "");
      },
      ".relation": {
        "rel<-d.relations": {
          ".rel-name": "rel.relation",
          ".children": function(ctxt){
            return exports.status.data({data: ctxt.rel.item.children});
          },
          ".children@class": function(ctxt){
            return (ctxt.rel.item.children.length == 0 ? "hidden" : "");
          }
        }
      }
    }
  }
});

exports.menu = template('ul.menu', {
  'li.sitelist': {
    'site<-sites': {
      'a.edit-link':      function(a){ return a.item.title || "Untitled"; },
      'a.edit-link@href': '#!/site/#{site.key}',
      'a.view-link@href': '/obj/#{site.key}/'
    }
  }
});

exports.open_website.list = template('#section-open-website ul', {
  'li': {
    'site<-sites': {
      'a':      "site.id",
      'a@href': '#!/site/#{site.id}'
    }
  }
});

exports.website = template('#section-website .siteinfo', {
  '.meta .revision':         "lastSignedSection",
  '.meta .key':              "siteKey",
  'input[name=title]@value': "title",
  'li.revitem': {
    'rev<-revisions': {
      'span.rev-num': 'rev.num',
      'span.rev-key': 'rev.key',
      'a.lnk-rev-view-site@href': function(a){
        var key = a.item.signed ? this.siteKey : a.item.key;
        return '/obj/' + key + ',' + a.item.num + '/';
      }
    }
  },
  'a.lnk-view-source@href': "/obj/#{siteKey}?content-type=text/plain",
  'li.newpage a@href': '#!/site/#{siteId}/newpage',
  'li.pageitem': {
    'page<-pages': {
      'a.edit-link':      'page.path',
      'a.edit-link@href': '#!/site/#{siteId}/page#{page.path}',
      'a.view-current-link@href': '/obj/#{siteKey}#{page.path}',
      'a.view-latest-link@href':  '/obj/#{siteKey},s#{page.path}',
      'span.section': 'page.section',
      '@class+': function(a) {
        return (a.item.section > a.context.lastSignedSection) ?
               ' unsigned' : ' signed'
      }
    }
  }
});

exports.website_page = template('#section-website-page', {
  'input[name=title]@value': 'title',
  'input[name=ctime]@value': 'ctime',
  'input[name=mtime]@value': 'mtime',
  'input[name=url]@value':   'url',
  'textarea[name=body]':     'body'
});

