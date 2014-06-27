
require(['/js/keygen', '/js/keytools', '/js/sign', '/js/router', '/js/sha1hex', '/js/pure/pure.js', '/js/loaded', '/js/blob/Blob', '/js/filesaver/FileSaver'],
  function(KeyGen, keytools, sign, Router, sha1hex, pure, _, _, saveAs)
{
  var pure = pure.$p;

  //
  // Local storage
  //

  localStorage.P2PWS = localStorage.P2PWS || {};

  //
  // Templates
  //

  var menu_template = pure('ul.menu').compile({
    'li.sitelist': {
      'site<-sites': {
        'a.edit-link':      "Site #{site.title}",
        'a.edit-link@href': '#!/site/#{site.key}',
        'a.view-link@href': '/obj/#{site.key}/'
      }
    }
  });

  var section_website_template = pure('#section-website').compile({
    '.meta .revision':         "lastSignedSection",
    '.meta .key':              "siteKey",
    'input[name=title]@value': "title",
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

  var section_website_page_template = pure('#section-website-page').compile({
    'input[name=title]@value': 'title',
    'input[name=ctime]@value': 'ctime',
    'input[name=mtime]@value': 'mtime',
    'input[name=url]@value':   'url',
    'textarea[name=body]':     'body'
  });

  //
  // Communication with server
  //

  var blobCache = {};

  function sendBlob(blob, blobid, content_type, cb){
    if(typeof blobid == "function") {
      cb = blobid;
      blobid = sha1hex(blob);
    }
    blobCache[blobid] = blob;
    var r = new XMLHttpRequest();
    r.open("PUT", "/obj/" + blobid);
    r.setRequestHeader("Content-Type", content_type);
    r.onreadystatechange = function(){
      if(!r.status) return;
      if(r.status >= 400) cb(r);
      else cb(null, blobid);
      r.onreadystatechange = undefined;
    };
    r.send(blob);
  }

  function getBlob(blobid, cache, cb) {
    if(blobid === undefined) throw new Error("id is undefined");
    if(typeof cache == "function") {
      cb = cache;
      cache = true;
    }
    if(cache && blobCache[blobid]) {
      return cb(null, blobCache[blobid]);
    }
    var r = new XMLHttpRequest();
    r.open("GET", "/obj/" + blobid);
    r.onreadystatechange = function(){
      if(r.readyState < 4) return;
      if(r.status >= 400) {
        cb(r);
      } else {
        blobCache[blobid] = r.responseText;
        cb(null, r.responseText);
      }
      r.onreadystatechange = undefined;
    };
    r.send();
  }

  function getBlobCache(blobid, cb) {
    return getBlob(blobid, true, cb);
  }

  function getBlobNoCache(blobid, cb) {
    return getBlob(blobid, false, cb);
  }

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
      siteList = JSON.parse(localStorage.getItem("P2PWS.siteList")) || [];
    } catch(e) {console.log(e);}
    if(siteList instanceof Array) siteList = {};
    return siteList;
  };

  function saveSiteList(siteList){
    localStorage.setItem("P2PWS.siteList", JSON.stringify(siteList))
  }

  //
  // Update UI
  //

  function updateMenu(){
    document.querySelector("ul.menu").outerHTML = menu_template({
      sites: getSiteList()
    });
  };

  var privateKeyStore = {}

  function updateSite(sitenum, site, privateKey){
    var pages = site.getFileList();
    var siteKey = site.getFirstId();
    var siteTitle = site.getLastHeader("Title");
    var pageArray = [];
    if(!privateKey) privateKey = privateKeyStore[siteKey];
    for(path in pages) {
      pages[path].path = path;
      pageArray.push(pages[path]);
    }
    document.querySelector('#section-website').outerHTML = section_website_template({
      site: site,
      title: siteTitle,
      siteKey: siteKey,
      siteId: sitenum || siteKey,
      pages: pageArray,
      lastSignedSection: site.getLastSignedSection()
    });

    var btn_open_pkey = document.querySelector('#section-website button.btn-open-pkey');
    var btn_save_pkey = document.querySelector('#section-website button.btn-save-pkey');
    var btn_sign_rev  = document.querySelector('#section-website button.btn-sign-revision');
    var input_title   = document.querySelector('#section-website input[name=title]');
    btn_open_pkey.disabled = privateKey;
    btn_save_pkey.disabled = !privateKey;
    btn_sign_rev.disabled  = !privateKey;

    input_title.addEventListener('input', function(){
      site.setUnsignedHeader("Title", this.value);
    })

    input_title.addEventListener('change', function(){
      saveSite(site);
    })

    keytools.install_open_key_handler(btn_open_pkey, function(err, privateKey_, crypt){
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
      btn_sign_rev.disabled  = false;
    });

    btn_save_pkey.addEventListener('click', function(){
      var blob = new Blob([privateKey], {type: "application/x-pem-file"});
      saveAs(blob, "private.pem");
    });

    btn_sign_rev.addEventListener('click', function(){
      site.addSignature(sign.sign(privateKey));
      saveSite(site);
      window.router.go("#!/site/" + (sitenum || siteKey));
    });
  }

  function parseMetaData(existingContent){
    var doc = (new DOMParser()).parseFromString(existingContent.body, "text/html");
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
    document.querySelector('#section-website-page').outerHTML = section_website_page_template(existingContent);
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
        var parser = new DOMParser();
        title.addEventListener('input', saveTitle);

        function getEditorDOM(){
          var html = editor.getContent();
          return parser.parseFromString(html, "text/html");
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
      var doc = (new DOMParser()).parseFromString(html, "text/html");
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

      sendBlob(doc, docid, "text/html; charset=utf-8", function(r, id){
        if(r) {
          console.error(r.status + ' ' + r.statusText);
          alert("Error: could not save to the server.\n" + r.status + " " + r.statusText);
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
    sendBlob(site.text, site.getFirstId(), "application/vnd.p2pws", function(r, id){
      if(r) {
        console.error(r.status + ' ' + r.statusText);
        alert("Error: could not save site to the server.\n" + r.status + " " + r.statusText);
      } else {
        //console.log("PUT /obj/" + id + " ok");
      }
    });
  }

  function getSiteWithUI(siteKey, callback){
    getBlobNoCache(siteKey, function(err, content){
      if(err) {
        alert("Could not load site " + siteKey + ":\n" + err.status + " " + err.statusText);
        return callback();
      }
      var site = new SignedHeader(sha1hex, sign.checksign);
      site.parseText(content, siteKey);
      
      var siteList = getSiteList();
      siteList[siteKey] = siteList[siteKey] || {};
      siteList[siteKey].key = siteKey;
      siteList[siteKey].title = site.getLastHeader("Title");
      saveSiteList(siteList);
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
      updateSite(null, site);
      document.querySelectorAll("#section-website-page").hide();
    });
  });

  r.on(/^\/site\/([0-9a-fA-F]+)\/newpage$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var siteKey = req[1].toLowerCase();
    getSiteWithUI(siteKey, function(site){
      if(!site) return r.go("#!/");
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
      updateSite(null, site);
      getBlobCache(pagemetadata.id, function(err, content){
        if(err || !content) {
          alert("Couldn't read page id " + pagemetadata.id + "\n" + err.status + " " + err.statusText);
          return r.go("#!/");
        }
        updateSitePageEditor(null, site, {
          url:  path,
          body: content
        });
      });
    });
  });

  r.fallback(function(){
    document.querySelectorAll("section.showhide").hide();
  });

  r.run();
});

