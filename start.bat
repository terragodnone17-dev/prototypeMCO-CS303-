@echo off
title Aqua Nhoy - Water Refilling Station Management System
echo ================================================================
echo  Aqua Nhoy - Water Refilling Station Management System (WRSMS)
echo  Starting SQLite-backed Local Server...
echo ================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Node.js detected. Starting server with direct wrsms.sqlite file storage...
    start http://localhost:3000
    node server.js
) else (
    echo Node.js not detected on PATH.
    echo Opening index.html directly in your default browser with OPFS SQLite storage...
    start "" index.html
)
pause
