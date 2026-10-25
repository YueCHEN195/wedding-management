@echo off
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0scripts\deploy\build-release.ps1" -Publish
set "release_exit=%ERRORLEVEL%"
pause
exit /b %release_exit%
