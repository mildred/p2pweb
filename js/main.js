
require('./blob/Blob');
require('./localStorage');
require('./loaded');

var moment   = require("./moment/min/moment-with-locales.js"),
    keytools = require('./keytools'),
    sign     = require('./sign'),
    Router   = require('./router'),
    sha1hex  = require('./sha1hex'),
    pure     = require('./pure/pure').$p,
    template = require('./template'),
    saveAs   = require('./filesaver/FileSaver');

function updateMoment(){
  var times = document.querySelectorAll("time.updated.momentFromNow[datetime]");
  for(var i = 0; i < times.length; i++) {
    var time = times[i];
    time.textContent = moment(time.getAttribute("datetime")).fromNow();
  }
}
updateMoment();
setInterval(updateMoment, 10000);

module.exports = function(api){

  //
  // Local storage
  //

  window.localStorage.P2PWS = window.localStorage.P2PWS || {};

  //
  // Rich text editor
  //

  function initEditor(selector, callbacks){
    //console.log('tinymce init: ' + selector);
    tinymce.remove(selector);
    tinymce.init({
      selector: selector,
      skin: "p2pweb",
      content_css: "style.css",
      plugins: "save autolink autoresize code hr link fullpage media image paste table",
      browser_spellcheck : true,

      // http://www.tinymce.com/wiki.php/Controls
      toolbar: "save fullpage code | undo redo | formatselect styleselect removeformat | bullist numlist | blockquote | link image media table hr",
      menubar : false,

      target_list: false, // link
      paste_data_images: true, // paste

      formats: {
          alignleft: {selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table,img', classes: 'left'},
          aligncenter: {selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table,img', classes: 'center'},
          alignright: {selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table,img', classes: 'right'},
          alignfull: {selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table,img', classes: 'justify'},
          bold: {inline: 'strong'},
          italic: {inline: 'em'},
          underline: {inline: 'add'},
          strikethrough: {inline: 'del'}
      },

      save_enablewhendirty: false,
      save_onsavecallback: callbacks.save,

      link_list: callbacks.link_list,
      init_instance_callback: callbacks.init,
      setup: callbacks.setup,
    });
  };

  //
  // Model: Site List
  //

  function getSiteList(){
    var siteList = [];
    try {
      siteList = JSON.parse(window.localStorage.getItem("P2PWS.siteList")) || [];
    } catch(e) {console.log(e);}
    if(siteList instanceof Array) siteList = {};
    return siteList;
  };

  function saveSiteList(siteList){
    window.localStorage.setItem("P2PWS.siteList", JSON.stringify(siteList))
  }

  function getServerSiteList(cb){
    var r = new XMLHttpRequest();
    r.open("GET", "/rpc/storage/sites");
    r.onreadystatechange = function(){
      if(r.readyState < 4) return;
      if(r.status >= 400) {
        cb(r);
      } else {
        var res = {};
        r.responseText.split('\n').forEach(function(s){
          s = s.split('\t');
          var id = s[0] || "";
          if(id.length == 0) return;
          res[id] = {
            id: id,
            signed_ids: (s[1] || "").split(' '),
            extra_ids:  (s[2] || "").split(' ')
          };
        });
        cb(null, res);
      }
      r.onreadystatechange = undefined;
    };
    r.send();

  }
  
  function updateSiteInList(siteKey, site) {
    var siteList = getSiteList();
    siteList[siteKey] = siteList[siteKey] || {};
    siteList[siteKey].key = siteKey;
    siteList[siteKey].title = site.getLastHeader("Title");
    saveSiteList(siteList);
  }

  //
  // Update UI
  //

  function updateMenu(){
    template.menu.push({
      sites: getSiteList()
    });
  };

  var privateKeyStore = {}

  function updateSite(sitenum, site, privateKey){
    var pages = site.getFileList();
    var siteKey = site.getFirstId();
    var siteTitle = site.getLastHeader("Title");
    var pageArray = [];
    var i = 0;
    var siteSectionIds = site.getSectionsIds();
    var revArray = siteSectionIds.map(function(e){
      return {key: e, signed: true, num: i++};
    });
    revArray.push({key: siteSectionIds.last, signed: false, num: i});
    if(!privateKey) privateKey = privateKeyStore[siteKey];
    for(path in pages) {
      pages[path].path = path;
      pageArray.push(pages[path]);
    }
    template.website.push({
      site: site,
      title: siteTitle,
      siteKey: siteKey,
      siteId: sitenum || siteKey,
      pages: pageArray,
      revisions: revArray,
      lastSignedSection: site.getLastSignedSection()
    });

    var btn_save_pkey = document.querySelector('#section-website button.btn-save-pkey');
    var btn_sign_rev  = document.querySelector('#section-website button.btn-sign-revision');
    var input_title   = document.querySelector('#section-website input[name=title]');
    btn_save_pkey.disabled = !privateKey;

    input_title.addEventListener('input', function(){
      site.setUnsignedHeader("Title", this.value);
      updateSiteInList(siteKey, site)
      updateMenu();
    })

    input_title.addEventListener('change', function(){
      saveSite(site);
      updateSite(sitenum, site);
    })

    var opener = keytools.install_file_opener(btn_sign_rev);

    btn_save_pkey.addEventListener('click', function(){
      var blob = new Blob([privateKey], {type: "application/x-pem-file"});
      saveAs(blob, "private.pem");
    });

    btn_sign_rev.addEventListener('click', function(){
      if(!privateKey) {
        opener(keyOpen);
      }
      if(privateKey) {
        site.addSignature(sign.sign(privateKey));
        saveSite(site);
        updateSite(sitenum, site);
      }
    });
    
    function keyOpen(err, privateKey_, crypt){
      if(err) {
        return alert("Could not load key file: " + err);
      }
      if(!privateKey_) {
        return alert("Key file doesn't contain private key.");
      }
      var publicKey = crypt.getKey().getPublicBaseKeyB64();
      var publicKeyExpected = site.getFirstHeader("PublicKey");
      if(publicKeyExpected != publicKey) {
        return alert("You selected the wrong key.\n" +
          "Expected public key: " + publicKeyExpected + "\n" +
          "Provided public key: " + publicKey);
      }
      privateKeyStore[siteKey] = privateKey = privateKey_;
      btn_save_pkey.disabled = false;
    }
  }
  
  function parseHTML(htmlCode) {
    var htmlCode = htmlCode || "<!DOCTYPE html5><html><head></head><body></body></html>";
    var doc = (new DOMParser()).parseFromString(htmlCode, "text/html");
    if(!doc) {
      doc = document.implementation.createHTMLDocument("");
  		doc.documentElement.innerHTML = htmlCode;
    }
    return doc;
  }

  function parseMetaData(existingContent){
    var doc = parseHTML(existingContent.body)
    var dateCreated = doc.head.querySelector("meta[name='dcterms.created']");
    var dateUpdated = doc.head.querySelector("meta[name='dcterms.date']");
    var title       = doc.head.querySelector("title");

    if(dateCreated) existingContent.ctime = dateCreated.getAttribute("content");
    if(dateUpdated) existingContent.mtime = dateUpdated.getAttribute("content");
    if(title)       existingContent.title = title.textContent;
  }

  function updateSitePageEditor(sitenum, site, existingContent){
    var siteKey = site.getFirstId();
    existingContent = existingContent || {};
    parseMetaData(existingContent);
    var newpage = !existingContent.url;
    var oldPath = existingContent.url;
    template.website_page.push(existingContent);
    var title  = document.querySelector("#section-website-page input[name=title]");
    var link   = document.querySelector("#section-website-page input[name=url]");
    var ctime  = document.querySelector("#section-website-page input[name=ctime]");
    var mtime  = document.querySelector("#section-website-page input[name=mtime]");
    var inputs = document.querySelectorAll("#section-website-page input[type=text]");

    updateTime();
    if(newpage) title.addEventListener('input', updateLinkURL);
    for(var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('input', updateInputSize);
    }

    initEditor("#section-website-page textarea.rich", {
      save: saveDocument,
      init: function(editor){
        title.addEventListener('input', saveTitle);

        function getEditorDOM(){
          var html = editor.getContent();
          return parseHTML(html);
        }

        function setEditorDOM(dom, onlyHEAD){
          var breakObject = {};
          var html = dom.documentElement.outerHTML;
          if(onlyHEAD) editor.on('BeforeSetContent', breakEvent);
          try {
            editor.setContent(html);
          } catch(e) {
            if(e !== breakObject) throw e;
          }
          if(onlyHEAD) editor.off('BeforeSetContent', breakEvent);

          function breakEvent(e){
            throw breakObject;
          }
        }

        function saveTitle(){
          var doc = getEditorDOM();
          var doc_title = doc.head.querySelector("title");
          if(!doc_title) {
            doc_title = doc.createElement("title");
            doc.head.appendChild(doc_title);
          }
          doc_title.textContent = this.value;
          setEditorDOM(doc, true);
        }
      },
      link_list: function(cb){
        var res = [];
        var pages = site.getFileList();
        for(path in pages) {
          res.push({
            title: path,
            value: "~" + path
          });
        }
        cb(res);
      }
    });

    function updateMarkupBeforeSave(html, path){
      var doc = parseHTML(html);
      var now = new Date();

      // http://wiki.whatwg.org/wiki/MetaExtensions

      if(!doc.head.querySelector("link[rel='schema.dcterms']")) {
        doc.head.insertAdjacentHTML('afterbegin',
          '<link rel="schema.dcterms" href="http://purl.org/dc/terms/">');
      }

      if(!doc.head.querySelector("link[rel='schema.p2pws']")) {
        doc.head.insertAdjacentHTML('afterbegin',
          '<link rel="schema.p2pws" href="tag:mildred.fr,2014:P2PWS/meta">');
      }

      setMeta(doc, 'dcterms.created', now.toISOString(), false);
      setMeta(doc, 'dcterms.date',    now.toISOString(), true);
      setMeta(doc, 'p2pws.site.sha1',     siteKey, true);
      setMeta(doc, 'p2pws.site.revision', site.getLastUnsignedSection(), true);
      setMeta(doc, 'p2pws.page.path',     path, true);

      function setMeta(doc, name, content, overwrite) {
        var tag = doc.head.querySelector("meta[name='" + name + "']");
        if(!tag) {
          tag = doc.createElement('meta');
          tag.setAttribute('name', name);
          doc.head.appendChild(tag);
          tag.setAttribute('content', content);
        } else if(overwrite) {
          tag.setAttribute('content', content);
        }
        return tag;
      }

      return doc.documentElement.outerHTML;
    }

    function saveDocument(editor){
      var path = link.value;
      var doc = updateMarkupBeforeSave(editor.getContent(), path);
      var docid = sha1hex(doc);
      if(oldPath && oldPath != path) {
        site.rmFile(oldPath);
      }
      site.addFile(path, docid, {'content-type': 'text/html; charset=utf-8'});

      saveSite(site);
      updateMenu();
      updateSite(sitenum, site);

      console.log("Save: " + doc);

      api.sendBlob(doc, docid, "text/html; charset=utf-8", function(e, id){
        if(e) {
          console.error(e.statusCode + " " + e.statusMessage);
          alert("Error: could not save to the server.\n" + e.statusCode + " " + e.statusMessage + "\n" + e.message);
        } else {
          //console.log("PUT /obj/" + id + " ok");
          window.router.go("#!/site/" + (sitenum || siteKey) + "/page" + path);
        }
      });
    }

    function updateLinkURL(){
      var today = new Date();
      var dd = today.getDate();
      var mm = today.getMonth()+1; //January is 0!
      var yyyy = today.getFullYear();
      if(dd<10) dd='0'+dd;
      if(mm<10) mm='0'+mm;
      var val = '/' + yyyy + '-' + mm + '-' + dd + '-' + title.value.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase() + '.html';
      if(link.generatedValue == link.value || link.value == "") {
        link.value = val;
        link.generatedValue = val;
        link.size = Math.max(link.getAttribute('size') || 10, val.length);
      }
    }

    function updateInputSize(){
      this.size = Math.max(this.getAttribute('size') || 10, this.value.length);
    }

    function updateTime(){
      var today = new Date();
      if(ctime.value == "" || ctime.value == ctime.generatedValue) {
        ctime.value = ctime.generatedValue = today.toISOString();
      }
      mtime.value = today.toISOString();
      setTimeout(updateTime, 1000);
    }
  }

  updateMenu();

  //
  // SignedHeader
  //

  function saveSite(site){
    //console.log(site);
    api.sendBlob(site.text, site.getFirstId(), "application/vnd.p2pws", function(e, id){
      if(e) {
        console.error(e.statusCode + " " + e.statusMessage);
        alert("Error: could not save site to the server.\n" + e.statusCode + " " + e.statusMessage + "\n" + e.message);
        // FIXME: we shouldn't reload in case of error because we are loosing changes here
      } else {
        //console.log("PUT /obj/" + id + " ok");
      }
    });
  }

  function getSiteWithUI(siteKey, callback){
    api.getBlobNoCache(siteKey, function(err, content){
      if(err) {
        alert("Could not load site " + siteKey + ":\n" + err);
        return callback();
      }
      if(!content) {
        alert("Could not load site " + siteKey + ":\nit has disappeared");
        return callback();
      }
      var site = new SignedHeader(sha1hex, sign.checksign);
      site.parseText(content, siteKey);
      
      updateSiteInList(siteKey, site);
      updateMenu();

      callback(site);
    });
  }

  var currentSite;

  //
  // Routing
  //

  var r = new Router();

  r.on("/site/open", function(){
    document.querySelectorAll("section.showhide").hide();
    var section = document.querySelector("section#section-open-website");
    section.show();
    var website_id = section.querySelector(".website input");
    var btn_ok     = section.querySelector(".btn-ok");
    
    btn_ok.addEventListener('click', Finish);

    getServerSiteList(function(err, list){
      if(err) {
        return alert("Error getting site list from server:\n" + err.status + " " + err.statusText + "\n" + err.responseText);
      }
      template.open_website.list.push({
        sites: list
      });
    });

    function Finish(){
      window.router.go("#!/site/" + website_id.value);
    }
  });

  r.on("/site/new", function(){
    document.querySelectorAll("section.showhide").hide();
    var section = document.querySelector("section#section-new-website");
    section.show();
    var website_id = section.querySelector(".website input");
    var btn_save   = section.querySelector(".btn-save");
    var btn_open   = section.querySelector(".btn-open");
    var btn_generate = section.querySelector(".btn-generate");
    var btn_ok     = section.querySelector(".btn-ok");
    var span_wid   = section.querySelector(".website span")
    var keylabel   = section.querySelector(".privkey span");

    btn_ok.disabled = true;
    btn_save.disabled = true;
    
    keytools.install_open_key_handler(btn_open, function(err, _, crypt){
      KeyAvailable(crypt, false);
    });
    btn_generate.addEventListener('click',
      keytools.generate_private_crypt_handler(1024, function(txt, crypt){
        console.log(txt);
        keylabel.textContent = txt;
        if(crypt) KeyAvailable(crypt, true);
      }));
    
    var crypt;
    var site;
    var id;

    function KeyAvailable(crypt_, generated){
      crypt = crypt_;
      site = new SignedHeader(sha1hex, sign.checksign);
      site.addHeader("Format", "P2P Website");
      site.addHeader("PublicKey", crypt.getKey().getPublicBaseKeyB64());
      site.addSignature(sign.sign(crypt));
      saveSite(site);
      id = site.getFirstId();
      span_wid.textContent = id;
      
      btn_save.disabled = false;
      btn_ok.disabled = generated;
    }

    btn_save.addEventListener('click', function(){
      keytools.save_private_crypt_handler(crypt);
      btn_ok.disabled = false;
    });

    btn_ok.addEventListener('click', function(){
      r.go("#!/site/" + id);
    });
  });

  r.on(/^\/site\/([0-9a-fA-F]+)$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var siteKey = req[1].toLowerCase();
    getSiteWithUI(siteKey, function(site){
      if(!site) return r.go("#!/");
      document.querySelectorAll("#section-website-page").hide();
      document.querySelectorAll("#section-website").show();
      updateSite(null, site);
    });
  });

  r.on(/^\/site\/([0-9a-fA-F]+)\/newpage$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var siteKey = req[1].toLowerCase();
    getSiteWithUI(siteKey, function(site){
      if(!site) return r.go("#!/");
      document.querySelectorAll("#section-website").show();
      updateSite(null, site);
      updateSitePageEditor(null, site);
    });
  });

  r.on(/^\/site\/([0-9a-fA-F]+)\/page(\/.*)$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var siteKey = req[1].toLowerCase();
    var path = req[2];
    getSiteWithUI(siteKey, function(site){
      if(!site) return r.go("#!/");
      var pagemetadata = site.getFile(path);
      document.querySelectorAll("#section-website").show();
      document.querySelectorAll("#section-website-page").show();
      updateSite(null, site);
      api.getBlobCache(pagemetadata.id, function(err, content){
        if(err || !content) {
          alert("Couldn't read page id " + pagemetadata.id + "\n" + err);
          return r.go("#!/");
        }
        updateSitePageEditor(null, site, {
          url:  path,
          body: content
        });
      });
    });
  });

  r.on("/status", function(req){
    document.querySelectorAll("section.showhide").hide();
    document.querySelectorAll("#section-status").show();
  });

  r.on(/^\/status\/seed\/([0-9a-fA-F]+)\/remove$/, function(req){
    var seedKey = req[1].toLowerCase();
    if(confirm("Delete seed " + seedKey + "?")) {
      api.removeSeed(seedKey, function(e){
        if(e) alert("Could not remove seed " + seedKey + ":\n" + e);
      });
    }
    history.go(-1);
  });

  r.fallback(function(){
    document.querySelectorAll("section.showhide").hide();
    if(typeof process == "object" && process.versions.node) r.go("#!/status")
  });

  r.run();

};

