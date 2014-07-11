#!/bin/sh
cd "$(dirname "$0")"
root="$PWD"
cd js
ln -sfn ../node_modules/tinymce       tinymce
ln -sfn $root/tinymce-skin-p2pweb     tinymce/skins/p2pweb
ln -sfn $root/tinymce-skin-p2pweb     tinymce-dev/js/tinymce/skins/p2pweb
ln -sfn ../node_modules/jsencrypt/bin jsencrypt
ln -sfn ../node_modules/jssha/src     jssha
ln -sfn ../node_modules/pure/libs     pure
ln -sfn ../node_modules/moment/       moment

