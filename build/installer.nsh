# Custom NSIS hooks for HIUS Todo.
#
# Desktop and Start Menu shortcuts are no longer created automatically
# (createDesktopShortcut/createStartMenuShortcut are disabled in package.json).
# Instead, an extra installer page lets the user choose which shortcuts to create
# via checkboxes, and the shortcuts are created/removed here to match that choice.
#
# electron-builder compiles the uninstaller in a separate pass (BUILD_UNINSTALLER),
# where the custom page is not added. To avoid "unreferenced function/variable"
# warnings (which are treated as errors) in that pass, everything that only the
# installer uses is wrapped in !ifndef BUILD_UNINSTALLER. Only customUnInstall, which
# runs in the uninstaller, stays outside the guard.

# Remove our manually created shortcuts on uninstall. The built-in uninstaller skips
# this because createDesktopShortcut/createStartMenuShortcut are disabled, so do it
# here. setLinkVars runs just before customUnInstall, so the link vars are populated.
!macro customUnInstall
  WinShell::UninstShortcut "$oldDesktopLink"
  Delete "$oldDesktopLink"
  WinShell::UninstShortcut "$newDesktopLink"
  Delete "$newDesktopLink"

  WinShell::UninstShortcut "$oldStartMenuLink"
  Delete "$oldStartMenuLink"
  WinShell::UninstShortcut "$newStartMenuLink"
  Delete "$newStartMenuLink"
!macroend

!ifndef BUILD_UNINSTALLER

!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

!ifndef BST_CHECKED
  !define BST_CHECKED 1
!endif

Var ShortcutOptionsDesktopCheckbox
Var ShortcutOptionsStartMenuCheckbox
Var CreateDesktopShortcutState
Var CreateStartMenuShortcutState

# Default both options to checked. Silent installs skip the custom page, so these
# defaults preserve the previous "create both" behavior there.
!macro customInit
  StrCpy $CreateDesktopShortcutState ${BST_CHECKED}
  StrCpy $CreateStartMenuShortcutState ${BST_CHECKED}
!macroend

# Shown after the install-location page and before files are copied.
!macro customPageAfterChangeDir
  Page custom ShortcutOptionsPageShow ShortcutOptionsPageLeave
!macroend

Function ShortcutOptionsPageShow
  # Set the page header title/subtitle directly. MUI's MUI_HEADER_TEXT macro is not
  # available here because this script is included before MUI2.nsh, so write to the
  # standard MUI header controls (1037 = title, 1038 = subtitle) instead.
  GetDlgItem $1 $HWNDPARENT 1037
  SendMessage $1 ${WM_SETTEXT} 0 "STR:바로 가기 옵션"
  GetDlgItem $1 $HWNDPARENT 1038
  SendMessage $1 ${WM_SETTEXT} 0 "STR:생성할 바로 가기를 선택하세요."

  nsDialogs::Create 1018
  Pop $0
  ${if} $0 == error
    Abort
  ${endif}

  ${NSD_CreateCheckbox} 0 10u 100% 12u "바탕화면에 바로 가기 만들기"
  Pop $ShortcutOptionsDesktopCheckbox
  ${if} $CreateDesktopShortcutState == ${BST_CHECKED}
    ${NSD_Check} $ShortcutOptionsDesktopCheckbox
  ${endif}

  ${NSD_CreateCheckbox} 0 30u 100% 12u "시작 메뉴에 추가"
  Pop $ShortcutOptionsStartMenuCheckbox
  ${if} $CreateStartMenuShortcutState == ${BST_CHECKED}
    ${NSD_Check} $ShortcutOptionsStartMenuCheckbox
  ${endif}

  nsDialogs::Show
FunctionEnd

Function ShortcutOptionsPageLeave
  ${NSD_GetState} $ShortcutOptionsDesktopCheckbox $CreateDesktopShortcutState
  ${NSD_GetState} $ShortcutOptionsStartMenuCheckbox $CreateStartMenuShortcutState
FunctionEnd

# Create the chosen shortcuts. Mirrors electron-builder's own CreateShortCut calls
# (target, icon, AppUserModelID) so the shortcuts behave identically.
!macro customInstall
  ${if} $CreateDesktopShortcutState == ${BST_CHECKED}
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${endif}
  ${if} $CreateStartMenuShortcutState == ${BST_CHECKED}
    !insertmacro createMenuDirectory
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${endif}
!macroend

!endif # !BUILD_UNINSTALLER
