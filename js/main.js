
require(['/js/keygen', '/js/sign', '/js/router', '/js/sha1hex', '/js/pure/pure.js', '/js/loaded', '/js/blob/Blob', '/js/filesaver/FileSaver'],
  function(KeyGen, sign, Router, sha1hex, pure, _, _, saveAs)
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
        'a':      function(a){ return "Site " + a.item.siteKey; },
        'a@href': '#!/site/#{site.pos}'
      }
    }
  });
  
  var section_website_template = pure('#section-website').compile({
    'h1': function(a){ return "Site " + a.context.siteKey; },
    'li.newpage a@href': '#!/site/#{siteNum}/newpage',
    'li.pageitem': {
      'page<-pages': {
        'a':      'page.path',
        'a@href': '#!/site/#{siteNum}/page#{page.path}',
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
  
  function initEditor(selector, onsave, oninit, onsetup){
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
      save_onsavecallback: onsave,
      
      init_instance_callback: oninit,
      setup: onsetup
    });
  };
  
  //
  // Generate Key
  //
  
  var keygen = new KeyGen(document.querySelector(".privkey"));
  
  //
  // Model: Site List
  //
  
  function getSiteList(callback){
    var siteList = [];
    try {
      siteList = JSON.parse(localStorage.getItem("P2PWS.siteList")) || [];
    } catch(e) {console.log(e);}
    for(var i = 0; i < siteList.length; i++) {
      siteList[i].getSite = function(callback){
        // FIXME: no this.siteKey but this.site
        if(this.site && !this.siteKey) {
          var s = new SignedHeader();
          s.parseText(this.site);
          this.siteKey = s.getFirstId(sha1hex);
        }
        getBlobNoCache(this.siteKey, function(err, content){
          if(err) return callback(err);
          var s = new SignedHeader();
          s.parseText(content);
          return callback(null, s);
        });
      };
    }
    return siteList;
  };

  function saveSiteList(siteList){
    var siteList2 = {};
    for(k in siteList) {
      siteList2[k] = {
        siteKey: siteList[k].siteKey,
        key:     siteList[k].key
      };
    }
    localStorage.setItem("P2PWS.siteList", JSON.stringify(siteList))
    //console.log("save to localStorage");
    //console.log(siteList);
  }
  
  function addSiteToList(siteList, site, privateKey, overwrite){
    for(var i = 0; i < siteList.length; i++){
      var s = siteList[i];
      if(s.key == privateKey) {
        if(overwrite) s.site = site;
        return i;
      }
    }
    siteList.push({
      siteKey: site.getFirstId(sha1hex),
      getSite: function(cb){ return cb(null, site); },
      key: privateKey
    });
    return siteList.length - 1;
  }
  
  var siteList = getSiteList();
  
  //
  // Update UI
  //

  function updateMenu(){
    document.querySelector("ul.menu").outerHTML = menu_template({
      sites: siteList // FIXME: fetch sites before, or do we?
    });
  };
  
  function updateSite(sitenum, site, privateKey){
    var pages = site.getFileList();
    var pageArray = [];
    for(path in pages) {
      pages[path].path = path;
      pageArray.push(pages[path]);
    }
    document.querySelector('#section-website').outerHTML = section_website_template({
      site: site,
      siteKey: site.getFirstId(sha1hex),
      siteNum: sitenum,
      pages: pageArray,
      lastSignedSection: site.getLastSignedSection()
    });
    if(privateKey) {
      document.querySelector('#section-website button.btn-save-pkey').addEventListener('click', function(){
        var blob = new Blob([privateKey], {type: "application/x-pem-file"});
        saveAs(blob, "private.pem");
      });
      document.querySelector('#section-website button.btn-sign-revision').addEventListener('click', function(){
        site.addSignature(sign.sign(privateKey));
        saveSite(site);
        saveSiteList(siteList);
        updateSite(sitenum, site, privateKey);
        window.location = "#!/site/" + sitenum;
      });
    }
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

    initEditor("#section-website-page textarea.rich", saveDocument, function(editor){
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
    });
    
    function updateMarkupBeforeSave(html){
      var doc = (new DOMParser()).parseFromString(html, "text/html");
      var now = new Date();
      
      // http://wiki.whatwg.org/wiki/MetaExtensions
      
      if(!doc.head.querySelector("link[rel='schema.dcterms']")) {
        doc.head.insertAdjacentHTML('afterbegin',
          '<link rel="schema.dcterms" href="http://purl.org/dc/terms/">');
      }

      var dateCreated = doc.head.querySelector("meta[name='dcterms.created']");
      if(!dateCreated) {
        dateCreated = doc.createElement('meta');
        dateCreated.setAttribute('name',    'dcterms.created');
        dateCreated.setAttribute('content', now.toISOString());
        doc.head.appendChild(dateCreated);
      }

      var dateUpdated = doc.head.querySelector("meta[name='dcterms.date']");
      if(!dateUpdated) {
        dateUpdated = doc.createElement('meta');
        dateUpdated.setAttribute('name',    'dcterms.date');
        doc.head.appendChild(dateUpdated);
      }
      dateUpdated.setAttribute('content', now.toISOString());
      
      return doc.documentElement.outerHTML;
    }
    
    function saveDocument(editor){
      var doc = updateMarkupBeforeSave(editor.getContent());
      var docid = sha1hex(doc);
      var path = link.value;
      if(oldPath && oldPath != path) {
        site.rmFile(oldPath);
      }
      site.addFile(path, docid, {'content-type': 'text/html; charset=utf-8'});

      saveSite(site);
      saveSiteList(siteList);
      updateMenu();
      updateSite(sitenum, site);

      console.log("Save: " + doc);

      sendBlob(doc, docid, "text/html; charset=utf-8", function(r, id){
        if(r) {
          console.error(r.status + ' ' + r.statusText);
          alert("Error: could not save to the server.\n" + r.status + " " + r.statusText);
        } else {
          //console.log("PUT /obj/" + id + " ok");
          if(oldPath != path) {
            window.location = "#!/site/" + sitenum + "/page" + path;
          } else {
            updateSitePageEditor(sitenum, site, {url:path, body: doc});
          }
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
    sendBlob(site.text, site.getFirstId(sha1hex), "application/vnd.p2pws", function(r, id){
      if(r) {
        console.error(r.status + ' ' + r.statusText);
        alert("Error: could not save site to the server.\n" + r.status + " " + r.statusText);
      } else {
        //console.log("PUT /obj/" + id + " ok");
      }
    });
  }
  
  var currentSite;

  //
  // Routing
  //

  var r = new Router();

  r.on(/^\/site\/([0-9]+)$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var sitenum = parseInt(req[1]);
    var site = siteList[sitenum];
    if(!site) window.router.go("#!/");
    site.getSite(function(err, s){
      if(err) {
        alert("Error reading site " + site.siteKey + "\n" + err.status + " " + err.statusText);
        window.router.go("#!/");
        return;
      }
      //console.log(site);
      updateSite(sitenum, s, site.key);
      document.querySelectorAll("#section-website-page").hide();
    });
  });

  r.on("/site/new", function(){
    document.querySelectorAll("section.showhide").hide();
    document.querySelectorAll("section#section-new-website").show();
    
    keygen.onkey = function(crypt){
      currentSite = new SignedHeader();
      currentSite.addHeader("Format", "P2P Website");
      currentSite.addHeader("PublicKey", crypt.getKey().getPublicBaseKeyB64());
      currentSite.addSignature(sign.sign(crypt));
      saveSite(currentSite);
      console.log(currentSite);
      var i = addSiteToList(siteList, currentSite, crypt.getPrivateKey(), false);
      saveSiteList(siteList);
      updateMenu();
      window.router.go("#!/site/" + i);
    };
  });

  r.on(/^\/site\/([0-9]+)\/newpage$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var sitenum = parseInt(req[1]);
    var site = siteList[sitenum];
    if(!site) window.router.go("#!/");
    site.getSite(function(err, s){
      if(err) {
        alert("Error reading site " + site.siteKey + "\n" + err.status + " " + err.statusText);
        window.router.go("#!/");
        return;
      }
      updateSite(sitenum, s, site.key);
      updateSitePageEditor(sitenum, s);
    });
  });

  r.on(/^\/site\/([0-9]+)\/page(\/.*)$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var sitenum = parseInt(req[1]);
    var path = req[2];
    var site = siteList[sitenum]; // FIXME
    if(!site) window.router.go("#!/");
    site.getSite(function(err, s){
      if(err) {
        alert("Error reading site " + site.siteKey + "\n" + err.status + " " + err.statusText);
        window.router.go("#!/");
        return;
      }
      var pagemetadata = s.getFile(path);
      updateSite(sitenum, s, site.key);
      getBlobCache(pagemetadata.id, function(err, content){
        if(err || !content) {
          alert("Couldn't read page id " + pagemetadata.id + "\n" + err.status + " " + err.statusText);
          window.router.go("#!/");
          return;
        }
        updateSitePageEditor(sitenum, s, {
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

