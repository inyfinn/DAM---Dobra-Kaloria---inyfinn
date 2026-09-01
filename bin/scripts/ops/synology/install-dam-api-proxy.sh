#!/bin/sh
set -e
SRC="/volume1/web/_nginx/www.dam-api.conf"
DST="/usr/local/etc/nginx/conf.d/www.dam-api.conf"
cp "$SRC" "$DST"
nginx -t
nginx -s reload
echo "OK: dam-api proxy zainstalowany"
