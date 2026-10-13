# ERP-WORKFLOW - demarrage du kit de test (Windows, Docker Desktop).
# Lance par demarrer-test.bat (double-clic).
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Fin($code) { Write-Host ''; Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null; exit $code }

Write-Host ''
Write-Host '=== ERP-WORKFLOW : kit de test avec MySQL ===' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host 'Docker Desktop n''est pas installé.' -ForegroundColor Red
  Write-Host 'Téléchargez-le sur https://www.docker.com/products/docker-desktop/ , installez-le, redémarrez l''ordinateur, puis relancez ce fichier.'
  Fin 1
}
$ErrorActionPreference = 'Continue'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker Desktop est installé mais pas démarré.' -ForegroundColor Red
  Write-Host 'Ouvrez Docker Desktop, attendez « Engine running » (voyant vert en bas à gauche), puis relancez ce fichier.'
  Fin 1
}

# Mots de passe aléatoires, créés une seule fois dans le fichier .env (à ne pas partager).
function New-Secret([int]$n) {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'.ToCharArray()
  $bytes = New-Object byte[] $n
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
if (-not (Test-Path -LiteralPath '.env')) {
  $lines = @(
    "DB_PASSWORD=$(New-Secret 24)",
    "DB_ROOT_PASSWORD=$(New-Secret 24)",
    "SETUP_CODE=$(New-Secret 16)",
    'APP_PORT=8080',
    'PMA_PORT=8081'
  )
  [System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot '.env'), $lines)
  Write-Host 'Mots de passe de test créés dans le fichier .env.' -ForegroundColor Green
}
$cfg = @{}
Get-Content -LiteralPath '.env' | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $cfg[$Matches[1]] = $Matches[2] } }
$appPort = if ($cfg['APP_PORT']) { $cfg['APP_PORT'] } else { '8080' }
$pmaPort = if ($cfg['PMA_PORT']) { $cfg['PMA_PORT'] } else { '8081' }

Write-Host 'Préparation des conteneurs (la première fois : 5 à 15 minutes, connexion Internet nécessaire)...'
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Le démarrage a échoué. Lisez les messages ci-dessus (souvent : port 8080 déjà utilisé -> changez APP_PORT dans .env).' -ForegroundColor Red
  Fin 1
}

Write-Host 'Attente du serveur RHEMA...'
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$appPort/api/health"
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  Write-Host 'Le serveur ne répond pas encore. Journal : docker compose logs app' -ForegroundColor Yellow
  Fin 1
}

Write-Host ''
Write-Host 'Tout est prêt.' -ForegroundColor Green
Write-Host ''
Write-Host "  Application         : http://localhost:$appPort"
Write-Host "  Code d'installation : $($cfg['SETUP_CODE'])   (demandé une seule fois, au premier accès)"
Write-Host ''
Write-Host "  phpMyAdmin (MySQL)  : http://localhost:$pmaPort"
Write-Host "      utilisateur     : erp_workflow"
Write-Host "      mot de passe    : $($cfg['DB_PASSWORD'])"
Write-Host ''
Write-Host 'Pour arrêter : arreter-test.bat   |   Pour tout effacer : reinitialiser-test.bat'
Start-Process "http://localhost:$appPort"
Fin 0
