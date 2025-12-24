; ITAM Agent Windows Installer (NSIS)
; build/win/installer.nsi

Name "ITAM Agent"
OutFile "itam-agent-win.exe"
RequestExecutionLevel admin
ShowInstDetails show
SetCompress auto
SetCompressor /SOLID lzma

; Add install page to show progress
Page instfiles

Var PSExe

Section
  ; Resolve C:\ProgramData at runtime and set install dir
  ReadEnvStr $0 "ProgramData"                ; e.g. C:\ProgramData
  StrCpy $INSTDIR "$0\ITAM"

  DetailPrint "Target directory: $INSTDIR"
  DetailPrint "Cleaning up old installations..."
  
  ; Remove any old scheduled tasks
  nsExec::ExecToLog 'schtasks /Delete /TN "ITAM Agent" /F'
  nsExec::ExecToLog 'schtasks /Delete /TN "ITAMAgent" /F'
  nsExec::ExecToLog 'schtasks /Delete /TN "OpenAudit" /F'
  nsExec::ExecToLog 'schtasks /Delete /TN "OA_Agent" /F'
  
  ; Delete old script files from various possible locations
  Delete "$INSTDIR\oa_agent.ps1"
  Delete "$INSTDIR\openaudit_agent.ps1"
  Delete "$INSTDIR\audit.ps1"
  Delete "C:\Program Files\ITAM\*.ps1"
  Delete "C:\ITAM\*.ps1"
  
  DetailPrint "Old installations cleaned."
  
  ; Ensure app directory exists
  CreateDirectory "$INSTDIR"
  SetOutPath "$INSTDIR"
  
  DetailPrint "Copying new PowerShell script..."

  ; Drop the advanced agent script into C:\ProgramData\ITAM
  ; (relative to this .nsi file: build/win/files/oa_agent_advanced.ps1)
  File /oname=oa_agent_advanced.ps1 "${__FILEDIR__}\files\oa_agent_advanced.ps1"
  File /oname=run_agent.bat "${__FILEDIR__}\files\run_agent.bat"
  File /oname=cleanup.bat "${__FILEDIR__}\files\cleanup.bat"
  File /oname=diagnose.bat "${__FILEDIR__}\files\diagnose.bat"
  
  ; Copy enrollment.conf if it exists (for multi-tenancy) - use /nonfatal to make it optional
  File /nonfatal /oname=enrollment.conf "${__FILEDIR__}\enrollment.conf"
  
  DetailPrint "Script copied successfully."
  DetailPrint "Script location: $INSTDIR\oa_agent_advanced.ps1"

  ; Choose 64-bit PowerShell (Sysnative) with safe fallback to System32
  StrCpy $PSExe "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists "$PSExe" +2 0
    StrCpy $PSExe "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
  
  DetailPrint "PowerShell executable: $PSExe"
  DetailPrint "Executing PowerShell script..."

  ; Run batch file wrapper with visible window to see any errors
  DetailPrint "Running initial audit..."
  ExecWait '"$INSTDIR\run_agent.bat"' $0
  
  DetailPrint "PowerShell exit code: $0"
  
  ; Create scheduled task to run daily at 2 AM
  DetailPrint "Creating scheduled task for daily audits..."
  nsExec::ExecToLog 'schtasks /Create /SC DAILY /TN "ITAM Agent" /TR "\"$PSExe\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"& \\\"$INSTDIR\oa_agent_advanced.ps1\\\" -debugging 0 -submit_online y -create_file n\"" /ST 02:00 /RL HIGHEST /F'
  Pop $1
  DetailPrint "Scheduled task creation result: $1"
  
  DetailPrint "Installation complete."
  MessageBox MB_OK "Installation finished. Exit code: $0$\n$\nThe script file is at: $INSTDIR\oa_agent_advanced.ps1$\n$\nA scheduled task has been created to run daily at 2 AM.$\n$\nPlease check if the device appears in OpenAudit."
SectionEnd
