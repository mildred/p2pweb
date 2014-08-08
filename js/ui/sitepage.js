
var sha1hex    = require('./../sha1hex'),
    parseHTML  = require('./../parsehtml'),
    template   = require('./template'),
    ui_editor  = require('./editor'),
    updateMenu = require('./menu'),
    updateSite = require('./site');

function updateSitePageEditor(localSiteList, saveSite, savePage, sitenum, site, existingContent){
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

  ui_editor.init("#section-website-page textarea.rich", {
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
    updateMenu(localSiteList.getList());
    updateSite(localSiteList, saveSite, sitenum, site);

    savePage(sitenum || siteKey, path, docid, doc);
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
  
  function parseMetaData(existingContent){
    var doc = parseHTML(existingContent.body)
    var dateCreated = doc.head.querySelector("meta[name='dcterms.created']");
    var dateUpdated = doc.head.querySelector("meta[name='dcterms.date']");
    var title       = doc.head.querySelector("title");

    if(dateCreated) existingContent.ctime = dateCreated.getAttribute("content");
    if(dateUpdated) existingContent.mtime = dateUpdated.getAttribute("content");
    if(title)       existingContent.title = title.textContent;
  }
}

module.exports = updateSitePageEditor;
