#!/bin/sh
# Construit le paquet « RHEMA-Test-Windows.zip » (test sans Docker).
# Prérequis : application compilée en mode serveur dans dist/ (VITE_BACKEND=api npm run build).
# Usage : sh test-sans-docker/construire-paquet.sh   -> paquet/RHEMA-Test-Windows.zip
set -e
NODE_VERSION=${NODE_VERSION:-22.11.0}
OUT=paquet/RHEMA-Test-Windows
test -f dist/index.html || { echo "dist/ introuvable : compilez d'abord l'application (VITE_BACKEND=api npm run build)."; exit 1; }

rm -rf paquet
mkdir -p "$OUT/app/server" "$OUT/app/shared" "$OUT/node"
cp test-sans-docker/demarrer.bat test-sans-docker/reinitialiser.bat test-sans-docker/LISEZ-MOI.txt "$OUT/"
cp test-sans-docker/lanceur.mjs "$OUT/app/"
cp server/*.mjs "$OUT/app/server/"
cp shared/*.mjs "$OUT/app/shared/"
cp -r dist "$OUT/app/dist"

# Pilote MySQL (seule dépendance du serveur).
( cd "$OUT/app" && npm init -y >/dev/null && npm install mysql2@3 --omit=dev --no-audit --no-fund --loglevel=error )

# Node.js pour Windows (exécutable seul, aucune installation).
curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-win-x64.zip" -o /tmp/node-win.zip
unzip -j -q /tmp/node-win.zip "node-v$NODE_VERSION-win-x64/node.exe" "node-v$NODE_VERSION-win-x64/LICENSE" -d "$OUT/node"

( cd paquet && zip -q -r RHEMA-Test-Windows.zip RHEMA-Test-Windows )
ls -la paquet/RHEMA-Test-Windows.zip
