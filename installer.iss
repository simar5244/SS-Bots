; Inno Setup Script for AI Services Application
; This creates a single-file Windows installer that bundles everything

#define MyAppName "SS Bots"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SS Bots"
#define MyAppURL "https://yourwebsite.com"
#define MyAppExeName "SS Bots.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
OutputDir=installer-output
OutputBaseFilename=SSBots-Setup-{#MyAppVersion}
SetupIconFile=build\icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Node.js portable runtime
Source: "dist\node-portable\*"; DestDir: "{app}\node-portable"; Flags: ignoreversion recursesubdirs createallsubdirs

; Application files
Source: "dist\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Pre-built Next.js app
Source: ".next\*"; DestDir: "{app}\.next"; Flags: ignoreversion recursesubdirs createallsubdirs

; Node modules (pre-installed)
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

; Configuration files
Source: ".env.example"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "next.config.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "tsconfig.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "tailwind.config.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "postcss.config.js"; DestDir: "{app}"; Flags: ignoreversion

; Launcher script
Source: "dist\START_APP.bat"; DestDir: "{app}"; Flags: ignoreversion

; Icon
Source: "build\icon.ico"; DestDir: "{app}\build"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\START_APP.bat"; IconFilename: "{app}\build\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\START_APP.bat"; IconFilename: "{app}\build\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\START_APP.bat"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent shellexec

[Code]
var
  EnvPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  { Create custom page for environment variables }
  EnvPage := CreateInputQueryPage(wpSelectDir,
    'API Configuration', 'Configure your API keys',
    'Please enter your API keys. You can change these later by editing the .env file in the installation directory.');
  
  EnvPage.Add('OpenAI API Key:', False);
  EnvPage.Add('Supabase URL:', False);
  EnvPage.Add('Supabase Anon Key:', False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile: string;
  EnvContent: TStringList;
begin
  if CurStep = ssPostInstall then
  begin
    { Create .env file from user input }
    EnvFile := ExpandConstant('{app}\.env');
    EnvContent := TStringList.Create;
    try
      { Load example file if it exists }
      if FileExists(ExpandConstant('{app}\.env.example')) then
        EnvContent.LoadFromFile(ExpandConstant('{app}\.env.example'))
      else
      begin
        { Create basic .env structure }
        EnvContent.Add('# API Configuration');
        EnvContent.Add('OPENAI_API_KEY=');
        EnvContent.Add('');
        EnvContent.Add('# Supabase Configuration');
        EnvContent.Add('NEXT_PUBLIC_SUPABASE_URL=');
        EnvContent.Add('NEXT_PUBLIC_SUPABASE_ANON_KEY=');
        EnvContent.Add('');
        EnvContent.Add('# Application Settings');
        EnvContent.Add('NEXT_PUBLIC_APP_URL=http://localhost:3000');
      end;
      
      { Update with user-provided values if any }
      if EnvPage.Values[0] <> '' then
        EnvContent.Values['OPENAI_API_KEY'] := EnvPage.Values[0];
      if EnvPage.Values[1] <> '' then
        EnvContent.Values['NEXT_PUBLIC_SUPABASE_URL'] := EnvPage.Values[1];
      if EnvPage.Values[2] <> '' then
        EnvContent.Values['NEXT_PUBLIC_SUPABASE_ANON_KEY'] := EnvPage.Values[2];
      
      { Save .env file }
      EnvContent.SaveToFile(EnvFile);
    finally
      EnvContent.Free;
    end;
  end;
end;
