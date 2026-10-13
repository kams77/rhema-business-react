#!/bin/sh
# RHEMA Business - démarrage du kit de test (Mac / Linux, Docker Desktop).
#   Terminal :  sh demarrer-test.sh
cd "$(dirname "$0")" || exit 1

echo ""
echo "=== RHEMA Business : kit de test avec MySQL ==="
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop n'est pas installé : https://www.docker.com/products/docker-desktop/"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop n'est pas démarré : ouvrez-le, attendez « Engine running », puis relancez."
  exit 1
fi

secret() { LC_ALL=C tr -dc 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789' </dev/urandom | head -c "$1"; }
if [ ! -f .env ]; then
  umask 077
  {
    echo "DB_PASSWORD=$(secret 24)"
    echo "DB_ROOT_PASSWORD=$(secret 24)"
    echo "SETUP_CODE=$(secret 16)"
    echo "APP_PORT=8080"
    echo "PMA_PORT=8081"
  } > .env
  echo "Mots de passe de test créés dans le fichier .env."
fi
val() { sed -n "s/^$1=//p" .env | head -n 1; }
APP_PORT=$(val APP_PORT); APP_PORT=${APP_PORT:-8080}
PMA_PORT=$(val PMA_PORT); PMA_PORT=${PMA_PORT:-8081}

echo "Préparation des conteneurs (la première fois : 5 à 15 minutes, connexion Internet nécessaire)..."
if ! docker compose up -d --build; then
  echo "Le démarrage a échoué (souvent : port $APP_PORT déjà utilisé -> changez APP_PORT dans .env)."
  exit 1
fi

echo "Attente du serveur RHEMA..."
ok=0
i=0
while [ $i -lt 90 ]; do
  if curl -fsS "http://localhost:$APP_PORT/api/health" >/dev/null 2>&1; then ok=1; break; fi
  i=$((i + 1)); sleep 2
done
if [ $ok -ne 1 ]; then
  echo "Le serveur ne répond pas encore. Journal : docker compose logs app"
  exit 1
fi

echo ""
echo "Tout est prêt."
echo ""
echo "  Application         : http://localhost:$APP_PORT"
echo "  Code d'installation : $(val SETUP_CODE)   (demandé une seule fois, au premier accès)"
echo ""
echo "  phpMyAdmin (MySQL)  : http://localhost:$PMA_PORT"
echo "      utilisateur     : rhema"
echo "      mot de passe    : $(val DB_PASSWORD)"
echo ""
echo "Pour arrêter : sh arreter-test.sh   |   Pour tout effacer : sh reinitialiser-test.sh"
if [ -z "$RHEMA_NO_BROWSER" ]; then
  (open "http://localhost:$APP_PORT" || xdg-open "http://localhost:$APP_PORT") >/dev/null 2>&1 &
fi
