//
// Rich text editor
//

module.exports.init = function (selector, callbacks){
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
  
