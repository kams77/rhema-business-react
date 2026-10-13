# ERP-WORKFLOW - reinitialisation du kit de test (EFFACE toutes les donnees de test).
Set-Location -LiteralPath $PSScriptRoot
Write-Host ''
Write-Host 'ATTENTION : cette opération efface définitivement la base MySQL de test' -ForegroundColor Yellow
Write-Host '(organisation, agents, documents, paie...). Exportez d''abord une sauvegarde si besoin.' -ForegroundColor Yellow
$rep = Read-Host 'Tapez EFFACER pour confirmer'
if ($rep -ne 'EFFACER') { Write-Host 'Annulé : rien n''a été effacé.'; Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null; exit 0 }
docker compose down -v
Write-Host ''
Write-Host 'Base de test effacée. Relancez demarrer-test.bat pour repartir de zéro (même code d''installation).' -ForegroundColor Green
Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null
