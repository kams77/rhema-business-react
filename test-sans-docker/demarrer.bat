@echo off
chcp 65001 >nul
title RHEMA Business - test (laisser ouvert)
cd /d "%~dp0"
if not exist "%~dp0node\node.exe" (
  echo Le dossier "node" est introuvable : decompressez tout le fichier ZIP avant de lancer.
  pause
  exit /b 1
)
"%~dp0node\node.exe" "%~dp0app\lanceur.mjs" %*
echo.
pause
