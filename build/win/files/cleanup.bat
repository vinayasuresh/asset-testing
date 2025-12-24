@echo off
echo ============================================
echo ITAM Agent - Cleanup and Diagnostics
echo ============================================
echo.

echo [1/4] Checking for scheduled tasks...
schtasks /Query /FO LIST | findstr /I "ITAM OpenAudit OA_Agent ITAMAgent"
echo.

echo [2/4] Checking for script files...
echo.
if exist "C:\ProgramData\ITAM" (
    echo Found: C:\ProgramData\ITAM
    dir "C:\ProgramData\ITAM\*.ps1" "C:\ProgramData\ITAM\*.bat" 2>nul
) else (
    echo Not found: C:\ProgramData\ITAM
)
echo.
if exist "C:\Program Files\ITAM" (
    echo Found: C:\Program Files\ITAM
    dir "C:\Program Files\ITAM\*.ps1" 2>nul
)
if exist "C:\ITAM" (
    echo Found: C:\ITAM
    dir "C:\ITAM\*.ps1" 2>nul
)
echo.

echo [3/4] Removing old scheduled tasks...
schtasks /Delete /TN "ITAM Agent" /F 2>nul
schtasks /Delete /TN "ITAMAgent" /F 2>nul
schtasks /Delete /TN "OpenAudit" /F 2>nul
schtasks /Delete /TN "OA_Agent" /F 2>nul
echo Done.
echo.

echo [4/4] Removing old script files...
del "C:\ProgramData\ITAM\oa_agent.ps1" 2>nul
del "C:\ProgramData\ITAM\openaudit_agent.ps1" 2>nul
del "C:\ProgramData\ITAM\audit.ps1" 2>nul
del "C:\Program Files\ITAM\*.ps1" 2>nul
del "C:\ITAM\*.ps1" 2>nul
echo Done.
echo.

echo ============================================
echo Cleanup complete! 
echo Now run the installer to set up fresh.
echo ============================================
echo.
pause
