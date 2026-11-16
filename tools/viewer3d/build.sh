#!/bin/sh
# 3D表示の部品を作る：three.js（r187、GitHubのタグから取得）を node_modules/three に置いてから実行する
cd "$(dirname "$0")"
bun build src.js --format=iife --minify --target=browser --outfile=../../app/lib/viewer3d/viewer3d.js
