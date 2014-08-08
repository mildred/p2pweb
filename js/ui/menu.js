var template = require('./template');

module.exports = function(siteList){
  template.menu.push({
    sites: siteList
  });
}
