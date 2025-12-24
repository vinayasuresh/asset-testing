@echo off
echo ============================================
echo ITAM Agent - Full Diagnostics
echo ============================================
echo.

echo [Step 1] Checking PowerShell version...
powershell -Command "$PSVersionTable.PSVersion"
echo.

echo [Step 2] Checking script files...
if exist "C:\ProgramData\ITAM" (
    echo Found C:\ProgramData\ITAM
    dir "C:\ProgramData\ITAM" /S
) else (
    echo NOT FOUND: C:\ProgramData\ITAM
)
echo.

echo [Step 3] Checking scheduled tasks...
schtasks /Query /FO LIST | findstr /I "ITAM"
echo.

echo [Step 4] Testing PowerShell execution...
set TEST_SCRIPT=C:\ProgramData\ITAM\oa_agent_advanced.ps1
if exist "%TEST_SCRIPT%" (
    echo Script exists: %TEST_SCRIPT%
    echo File size:
    dir "%TEST_SCRIPT%" | findstr "oa_agent"
    echo.
    echo Testing script execution (first 50 lines of output):
    powershell -ExecutionPolicy Bypass -Command "& '%TEST_SCRIPT%' -debugging 1 -submit_online 'n' -create_file 'n' 2>&1 | Select-Object -First 50"
) else (
    echo Script NOT found: %TEST_SCRIPT%
)
echo.

echo [Step 5] Checking Windows Event Log for errors...
powershell -Command "Get-EventLog -LogName Application -Source 'Windows PowerShell' -Newest 5 -EntryType Error -ErrorAction SilentlyContinue | Format-List"
echo.

echo [Step 6] Testing network connectivity to OpenAudit...
echo Testing connection to: open-audit.vistrivetech.com
powershell -Command "Test-NetConnection -ComputerName open-audit.vistrivetech.com -Port 443"
echo.

echo ============================================
echo Diagnostics complete!
echo ============================================
pause
