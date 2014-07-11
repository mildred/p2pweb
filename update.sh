#!/bin/sh

cd "$(dirname "$0")"
set -e

git pull --ff-only
"$PWD/sysvservice.sh" install-deps
"$PWD/sysvservice.sh" install-init.d
"$PWD/sysvservice.sh" enable
"$PWD/sysvservice.sh" restart

