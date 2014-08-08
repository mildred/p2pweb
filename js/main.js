
require('./blob/Blob');
require('./localStorage');
require('./loaded');
require('./ui/moments');

var keytools             = require('./keytools'),
    sign                 = require('./sign'),
    Router               = require('./router'),
    sha1hex              = require('./sha1hex'),
    template             = require('./ui/template'),
    updateMenu           = require('./ui/menu'),
    updateSite           = require('./ui/site'),
    updateSitePageEditor = require('./ui/sitepage'),
    localSiteList        = require('./model/localsitelist');

module.exports = function(api){

  //
  // Update UI
  //

  updateMenu(localSiteList.getList());

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
  
  function saveBlob(docid, doc, content_type, callback){
    console.log("Save: " + doc);

    api.sendBlob(doc, docid, content_type, function(e, id){
      if(e) {
        console.error(e.statusCode + " " + e.statusMessage);
        alert("Error: could not save to the server.\n" + e.statusCode + " " + e.statusMessage + "\n" + e.message);
      }
      callback(e, id);
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
      
      localSiteList.updateSite(siteKey, site);
      updateMenu(localSiteList.getList());

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

    localSiteList.getServerList(function(err, list){
      if(err) {
        return alert("Error getting site list from server:\n" + err.status + " " + err.statusText + "\n" + err.responseText);
      }
      template.open_website.list.push({
        sites: list
      });
    });

    function Finish(){
      r.go("#!/site/" + website_id.value);
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
      updateSite(localSiteList, saveSite, null, site);
    });
  });
  
  function savePage(siteKey, path, docid, doc){
    saveBlob(docid, doc, "text/html; charset=utf-8", function(e, id){
      if(!e) r.go("#!/site/" + siteKey + "/page" + path);
    });
  }

  r.on(/^\/site\/([0-9a-fA-F]+)\/newpage$/, function(req){
    document.querySelectorAll("section.showhide").hide();
    var siteKey = req[1].toLowerCase();
    getSiteWithUI(siteKey, function(site){
      if(!site) return r.go("#!/");
      document.querySelectorAll("#section-website").show();
      updateSite(localSiteList, saveSite, null, site);
      updateSitePageEditor(localSiteList, saveSite, savePage, null, site);
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
      updateSite(localSiteList, saveSite, null, site);
      api.getBlobCache(pagemetadata.id, function(err, content){
        if(err || !content) {
          alert("Couldn't read page id " + pagemetadata.id + "\n" + err);
          return r.go("#!/");
        }
        updateSitePageEditor(localSiteList, saveSite, savePage, null, site, {
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

