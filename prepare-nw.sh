#!/bin/sh
cd "$(dirname "$0")"
root="$PWD"
cd js
ln -sf ../node_modules/tinymce       tinymce
ln -sf $root/tinymce-skin-p2pweb     tinymce/skins/p2pweb
ln -sf $root/tinymce-skin-p2pweb     tinymce-dev/js/tinymce/skins/p2pweb
ln -sf ../node_modules/jsencrypt/bin jsencrypt
ln -sf ../node_modules/jssha/src     jssha
ln -sf ../node_modules/pure/libs     pure

