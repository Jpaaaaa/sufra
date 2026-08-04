; sufra pos installer — final upgrade path
; 1) Force-kill running app (no Retry dialog)
; 2) Delete old install files + clear Uninstall registry
;    so electron-builder never runs the broken old uninstaller
; 3) Recreate desktop / Start Menu shortcuts with embedded icon

!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif

; ---------------------------------------------------------------------------
; Force-kill current + legacy process names (never prompt)
; ---------------------------------------------------------------------------
!macro SufraForceKillApps
  DetailPrint "Closing sufra pos processes..."

  nsExec::ExecToLog `taskkill /F /T /IM "sufra-pos.exe"`
  Pop $0
  ${nsProcess::KillProcess} "sufra-pos.exe" $R9

  nsExec::ExecToLog `taskkill /F /T /IM "sufra pos.exe"`
  Pop $0
  nsExec::ExecToLog `taskkill /F /T /IM "Sufra Lite POS.exe"`
  Pop $0
  nsExec::ExecToLog `taskkill /F /T /IM "SufraLitePOS.exe"`
  Pop $0

  nsExec::ExecToLog `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -ErrorAction SilentlyContinue | Where-Object { $$_.ProcessName -in @('sufra-pos','sufra pos','Sufra Lite POS','SufraLitePOS') } | Stop-Process -Force -ErrorAction SilentlyContinue; exit 0"`
  Pop $0

  Sleep 1500
!macroend

!macro SufraWaitUntilClosed
  StrCpy $R1 0
  SufraWaitLoop:
    IntOp $R1 $R1 + 1
    nsExec::ExecToLog `powershell -NoProfile -ExecutionPolicy Bypass -Command "$$names=@('sufra-pos','sufra pos','Sufra Lite POS','SufraLitePOS'); if (Get-Process -ErrorAction SilentlyContinue | Where-Object { $$names -contains $$_.ProcessName }) { exit 0 } else { exit 1 }"`
    Pop $R0
    ${If} $R0 == 0
      DetailPrint "App still running — force closing (attempt $R1)..."
      !insertmacro SufraForceKillApps
      ${If} $R1 < 12
        Goto SufraWaitLoop
      ${EndIf}
      DetailPrint "Continuing after forced close."
    ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; Force-delete a directory (rmdir + takeown retry — no nested quotes)
; ---------------------------------------------------------------------------
!macro SufraForceRemoveDir _DIR
  DetailPrint "Removing: ${_DIR}"
  nsExec::ExecToLog `cmd /c if exist "${_DIR}" rmdir /s /q "${_DIR}"`
  Pop $0
  Sleep 300
  nsExec::ExecToLog `cmd /c if exist "${_DIR}" (takeown /f "${_DIR}" /r /d y >nul 2>&1 & icacls "${_DIR}" /grant *S-1-5-32-544:F /t /c /q >nul 2>&1 & rmdir /s /q "${_DIR}")`
  Pop $0
  Sleep 300
  nsExec::ExecToLog `powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path -LiteralPath '${_DIR}') { Remove-Item -LiteralPath '${_DIR}' -Recurse -Force -ErrorAction SilentlyContinue }; exit 0"`
  Pop $0
!macroend

; ---------------------------------------------------------------------------
; Purge previous install so uninstallOldVersion is a no-op
; (fixes: cannot be closed / Failed to uninstall old application files: 2)
; ---------------------------------------------------------------------------
!macro SufraPurgeOldInstall
  DetailPrint "Preparing clean upgrade (removing previous files)..."
  !insertmacro SufraForceKillApps
  !insertmacro SufraWaitUntilClosed

  ; Paths recorded by previous installs
  StrCpy $R6 ""
  ReadRegStr $R6 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R6 != ""
    !insertmacro SufraForceRemoveDir "$R6"
  ${EndIf}

  StrCpy $R6 ""
  ReadRegStr $R6 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R6 != ""
    !insertmacro SufraForceRemoveDir "$R6"
  ${EndIf}

  ; Current target dir (already chosen by multiUser init)
  ${If} $INSTDIR != ""
    !insertmacro SufraForceRemoveDir "$INSTDIR"
  ${EndIf}

  ; Common fallbacks (legacy names / layouts)
  !insertmacro SufraForceRemoveDir "$PROGRAMFILES64\sufra pos"
  !insertmacro SufraForceRemoveDir "$PROGRAMFILES\sufra pos"
  !insertmacro SufraForceRemoveDir "$PROGRAMFILES64\Sufra Lite POS"
  !insertmacro SufraForceRemoveDir "$PROGRAMFILES\Sufra Lite POS"
  !insertmacro SufraForceRemoveDir "$LOCALAPPDATA\Programs\sufra pos"
  !insertmacro SufraForceRemoveDir "$LOCALAPPDATA\Programs\Sufra Lite POS"

  ; Clear Uninstall registry so electron-builder SKIPS the broken old uninstaller
  SetRegView 64
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
  SetRegView 32
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
  SetRegView 64

  ClearErrors
  Sleep 800
  DetailPrint "Previous installation cleaned."
!macroend

; Override app-running check — never show Retry
!macro customCheckAppRunning
  !insertmacro SufraForceKillApps
  !insertmacro SufraWaitUntilClosed
!macroend

!macro preInit
  !insertmacro SufraForceKillApps
!macroend

!macro customInit
  !insertmacro SufraPurgeOldInstall
!macroend

; If old uninstaller still ran somehow — never abort the new install
!macro customUnInstallCheck
  ClearErrors
  StrCpy $R0 0
  DetailPrint "Uninstall check OK (manual purge)."
!macroend

!macro customUnInstallCheckCurrentUser
  ClearErrors
  StrCpy $R0 0
!macroend

; After files land — shortcuts with exe icon
!macro customInstall
  !insertmacro SufraForceKillApps

  SetShellVarContext all
  Delete "$DESKTOP\sufra pos.lnk"
  Delete "$DESKTOP\Sufra Lite POS.lnk"
  Delete "$DESKTOP\sufra-pos.lnk"
  Delete "$SMPROGRAMS\sufra pos.lnk"
  Delete "$SMPROGRAMS\Sufra Lite POS.lnk"
  CreateShortCut "$DESKTOP\sufra pos.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortCut "$SMPROGRAMS\sufra pos.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0

  SetShellVarContext current
  Delete "$DESKTOP\sufra pos.lnk"
  Delete "$DESKTOP\Sufra Lite POS.lnk"
  CreateShortCut "$DESKTOP\sufra pos.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!macro customUnInstall
  !insertmacro SufraForceKillApps
  SetShellVarContext all
  Delete "$DESKTOP\sufra pos.lnk"
  Delete "$DESKTOP\Sufra Lite POS.lnk"
  Delete "$SMPROGRAMS\sufra pos.lnk"
  Delete "$SMPROGRAMS\Sufra Lite POS.lnk"
  SetShellVarContext current
  Delete "$DESKTOP\sufra pos.lnk"
  Delete "$DESKTOP\Sufra Lite POS.lnk"
!macroend

!macro customRemoveFiles
  !insertmacro SufraForceKillApps
  RMDir /r "$INSTDIR"
!macroend

; ---------------------------------------------------------------------------
; UI
; ---------------------------------------------------------------------------
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "مرحباً بك في sufra pos"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "نظام نقاط البيع الاحترافي للمطاعم والكافيهات.$\r$\n$\r$\nسيغلق المثبت أي نسخة سابقة ويزيل ملفاتها تلقائياً ثم يثبّت التحديث.$\r$\n$\r$\nاضغط «التالي» للمتابعة."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "جاهز لاستقبال الطلبات"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "تم تثبيت / تحديث sufra pos بنجاح.$\r$\n$\r$\nتم إنشاء اختصار سطح المكتب، ويمكنك تشغيل النظام الآن."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_RUN_TEXT "تشغيل sufra pos الآن"
  !define MUI_FINISHPAGE_NOREBOOTSUPPORT
  !insertmacro MUI_PAGE_FINISH
!macroend
