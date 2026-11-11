@echo off
chcp 65001 >nul
title ERP-GESDOC - reinitialisation
cd /d "%~dp0"
"%~dp0node\node.exe" "%~dp0app\lanceur.mjs" --reinitialiser
echo.
pause
