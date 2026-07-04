@echo off
title Sufra - Machine ID Generator
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0get-machine-id.ps1"
if errorlevel 1 pause
