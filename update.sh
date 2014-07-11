#!/bin/sh

zero="$0"
root="$(dirname "$0")"
set -e

pull(){
  ( cd "$root"
    git pull --ff-only
  )
  exec "$zero" the-rest
}

case "$1" in
  the-rest)
    cd "$root"
    "$PWD/sysvservice.sh" install-deps
    "$PWD/sysvservice.sh" install-init.d
    "$PWD/sysvservice.sh" enable
    "$PWD/sysvservice.sh" restart

    echo
    echo "Success"
    exit 0
  ;;
  *)
    pull
  ;;
esac

