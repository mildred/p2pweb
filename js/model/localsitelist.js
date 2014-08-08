
require('./../localStorage');

//
// Local storage
//

window.localStorage.P2PWS = window.localStorage.P2PWS || {};

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

module.exports.getList       = getSiteList;
module.exports.getServerList = getServerSiteList;
module.exports.updateSite    = updateSiteInList;

  
