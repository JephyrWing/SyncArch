#!/bin/sh
set -eu
# Cloudtype checks out the immutable Git ref; only this public revision is injected.
test "${#RELEASE_SHA}" -eq 40
case "$RELEASE_SHA" in *[!0-9a-f]*) exit 1;; esac
printf '{"revision": "%s"}\n' "$RELEASE_SHA" > /usr/share/nginx/html/release.json
