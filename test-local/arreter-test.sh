#!/bin/sh
# ERP-WORKFLOW - arrêt du kit de test (les données sont conservées).
cd "$(dirname "$0")" || exit 1
docker compose stop && echo "Kit de test arrêté. Vos données sont conservées : relancez sh demarrer-test.sh pour reprendre."
