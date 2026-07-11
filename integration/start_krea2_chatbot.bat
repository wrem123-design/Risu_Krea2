@echo off
setlocal
title Krea2 Chatbot Launcher

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\Chatbot\krea2_integration\start_krea2_stack.ps1"
if errorlevel 1 (
    echo.
    echo Krea2 services failed to start. Check E:\Chatbot\krea2_integration\logs.
    pause
    exit /b 1
)

start "" "E:\Chatbot\PocketRisu-v1.7.3-win-x64\PocketRisu.exe"
exit /b 0
