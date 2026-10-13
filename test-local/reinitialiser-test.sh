#!/bin/sh
# ERP-WORKFLOW - réinitialisation du kit de test (EFFACE toutes les données de test).
cd "$(dirname "$0")" || exit 1
echo "ATTENTION : cette opération efface définitivement la base MySQL de test."
printf "Tapez EFFACER pour confirmer : "
read rep
[ "$rep" = "EFFACER" ] || { echo "Annulé : rien n'a été effacé."; exit 0; }
docker compose down -v && echo "Base de test effacée. Relancez sh demarrer-test.sh pour repartir de zéro."
