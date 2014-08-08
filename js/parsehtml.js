module.exports = function(htmlCode) {
  var htmlCode = htmlCode || "<!DOCTYPE html5><html><head></head><body></body></html>";
  var doc = (new DOMParser()).parseFromString(htmlCode, "text/html");
  if(!doc) {
    doc = document.implementation.createHTMLDocument("");
		doc.documentElement.innerHTML = htmlCode;
  }
  return doc;
}
