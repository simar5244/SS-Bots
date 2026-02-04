@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Setup, Build, and Create Desktop Shortcut
echo ========================================
echo.
echo This will:
echo 1. Download Node.js portable (if needed)
echo 2. Install dependencies
echo 3. Build the Next.js app
echo 4. Create a desktop shortcut to launch the app
echo.
echo This takes 5-10 minutes
echo.
pause

set "SCRIPT_DIR=%~dp0"
set "NODE_DIR=%SCRIPT_DIR%node-portable"
set "NODE_VERSION=22.12.0"
set "NODE_ZIP=node-v%NODE_VERSION%-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/%NODE_ZIP%"

:: Check if Node portable exists
if not exist "%NODE_DIR%\node.exe" (
    echo [1/5] Downloading Node.js portable v%NODE_VERSION%...
    echo This takes 2-3 minutes...
    
    :: Download Node.js using PowerShell
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%SCRIPT_DIR%%NODE_ZIP%'}"
    
    if %errorlevel% neq 0 (
        echo ERROR: Failed to download Node.js
        pause
        exit /b 1
    )
    
    echo Extracting Node.js...
    powershell -Command "& {Expand-Archive -Path '%SCRIPT_DIR%%NODE_ZIP%' -DestinationPath '%SCRIPT_DIR%' -Force}"
    
    if %errorlevel% neq 0 (
        echo ERROR: Failed to extract Node.js
        pause
        exit /b 1
    )
    
    :: Rename extracted folder
    ren "%SCRIPT_DIR%node-v%NODE_VERSION%-win-x64" "node-portable"
    
    :: Clean up zip file
    del "%SCRIPT_DIR%%NODE_ZIP%"
    
    echo OK
    echo.
) else (
    echo [1/5] Node.js already installed - skipping download
    echo.
)

:: Add Node to PATH
set "PATH=%NODE_DIR%;%PATH%"

echo [2/5] Installing dependencies...
echo This takes 3-5 minutes...
call "%NODE_DIR%\npm.cmd" install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)
echo OK
echo.

echo [3/5] Building Next.js application...
echo This takes 2-3 minutes...
call "%NODE_DIR%\npm.cmd" run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo OK
echo.

echo [4/5] Creating desktop shortcut...

:: Get desktop path
for /f "usebackq tokens=3*" %%A in (`reg query "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" /v Desktop`) do set "DESKTOP=%%A %%B"
call set "DESKTOP=%DESKTOP%"

:: Create VBS script to make shortcut
set "VBS_FILE=%TEMP%\create_shortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_FILE%"
echo sLinkFile = "%DESKTOP%\AI Services.lnk" >> "%VBS_FILE%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_FILE%"
echo oLink.TargetPath = "%SCRIPT_DIR%START_APP.bat" >> "%VBS_FILE%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%VBS_FILE%"
echo oLink.Description = "Launch AI Services Application" >> "%VBS_FILE%"
echo oLink.IconLocation = "%SCRIPT_DIR%build\icon.png" >> "%VBS_FILE%"
echo oLink.Save >> "%VBS_FILE%"

cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%"

if exist "%DESKTOP%\AI Services.lnk" (
    echo Desktop shortcut created successfully
) else (
    echo Warning: Could not create desktop shortcut
)
echo.

echo [5/5] Creating START_APP.bat launcher...

:: Create the launcher script
(
echo @echo off
echo setlocal
echo.
echo set "SCRIPT_DIR=%%~dp0"
echo set "NODE_DIR=%%SCRIPT_DIR%%node-portable"
echo set "PATH=%%NODE_DIR%%;%%PATH%%"
echo.
echo echo Starting AI Services...
echo echo.
echo echo The app will open in your browser at http://localhost:3000
echo echo.
echo echo Keep this window open while using the app
echo echo Press Ctrl+C to stop the server
echo echo.
echo.
echo cd /d "%%SCRIPT_DIR%%"
echo call "%%NODE_DIR%%\npm.cmd" start
echo.
echo pause
) > "%SCRIPT_DIR%START_APP.bat"

echo Launcher created: START_APP.bat
echo.

echo ========================================
echo SUCCESS!
echo ========================================
echo.
echo Setup complete! You can now:
echo.
echo 1. Double-click the "AI Services" icon on your desktop
echo    OR
echo 2. Run START_APP.bat from this folder
echo.
echo The app will open at http://localhost:3000
echo.
echo Note: Make sure to configure your .env file with API keys
echo.

pause
