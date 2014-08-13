
var keytools      = require('./../keytools'),
    sign          = require('./../sign'),
    saveAs        = require('./../filesaver/FileSaver'),
    template      = require('./template'),
    updateMenu    = require('./menu');

var privateKeyStore = {}

function updateSite(localSiteList, saveSite, sitenum, site, privateKey){
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
    localSiteList.updateSite(siteKey, site)
    updateMenu(localSiteList.getList());
  })

  input_title.addEventListener('change', function(){
    saveSite(site);
    updateSite(localSiteList, saveSite, sitenum, site);
  });

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
      updateSite(localSiteList, saveSite, sitenum, site);
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

module.exports = updateSite;
