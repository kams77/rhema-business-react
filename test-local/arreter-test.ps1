# RHEMA Business - arret du kit de test (les donnees sont conservees).
Set-Location -LiteralPath $PSScriptRoot
docker compose stop
Write-Host ''
Write-Host 'Kit de test arrêté. Vos données sont conservées : relancez demarrer-test.bat pour reprendre.' -ForegroundColor Green
Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null
