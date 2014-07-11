#!/bin/sh

zero="$0"
root="$(dirname "$0")"
set -e

pull(){
  ( cd "$root"
    git pull --ff-only
  )
  if "$zero" the-rest; then
    echo "Success"
  else
    echo "Failure"
  fi
}

case "$1" in
  the-rest)
    cd "$root"
    "$PWD/sysvservice.sh" install-deps
    "$PWD/sysvservice.sh" install-init.d
    "$PWD/sysvservice.sh" enable || echo "Error ignored"
    "$PWD/sysvservice.sh" restart
    exit 0
  ;;
  *)
    pull
  ;;
esac

