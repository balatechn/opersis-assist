const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const config = require('../config');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const EXE_PATH = path.join(__dirname, '..', '..', 'agent-dist', 'opersis-assist-agent.exe');

// GET /api/agent/download/windows
// Serves a ZIP containing the agent exe + config.json + install/uninstall scripts
router.get('/download/windows', authenticate, requireRole('admin', 'operator'), (req, res) => {
  if (!fs.existsSync(EXE_PATH)) {
    return res.status(404).json({ error: 'Agent executable not found. Build may still be in progress.' });
  }

  // Determine WebSocket URL
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const wsProto = proto === 'https' ? 'wss' : 'ws';
  const wsUrl = process.env.WS_URL || `${wsProto}://${host}/ws/agent`;

  // Config file for the agent
  const configJson = JSON.stringify({
    serverUrl: wsUrl,
    agentSecret: config.agent.secret,
    statsInterval: 5000,
  }, null, 2);

  // Install batch script
  const installBat = `@echo off
echo ============================================
echo   Opersis Assist Agent - Windows Installer
echo ============================================
echo.

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Run this script as Administrator!
    echo Right-click install.bat and select "Run as administrator"
    pause
    exit /b 1
)

set INSTALL_DIR=%ProgramFiles%\\OpersisAssist
set DATA_DIR=%ProgramData%\\OpersisAssist

echo Creating directories...
mkdir "%INSTALL_DIR%" 2>nul
mkdir "%DATA_DIR%" 2>nul

echo Copying files...
copy /Y "%~dp0opersis-assist-agent.exe" "%INSTALL_DIR%\\opersis-assist-agent.exe"
copy /Y "%~dp0config.json" "%INSTALL_DIR%\\config.json"

echo Registering Windows service...
sc create OpersisAssistAgent binPath= "\\"%INSTALL_DIR%\\opersis-assist-agent.exe\\"" start= auto DisplayName= "Opersis Assist Agent"
sc description OpersisAssistAgent "Remote Monitoring and Management Agent"
sc failure OpersisAssistAgent reset= 86400 actions= restart/5000/restart/10000/restart/30000

echo Starting service...
sc start OpersisAssistAgent

echo.
echo ============================================
echo   Installation Complete!
echo ============================================
echo   Service: OpersisAssistAgent
echo   Install: %INSTALL_DIR%
echo   Data:    %DATA_DIR%
echo ============================================
pause
`;

  // Uninstall batch script
  const uninstallBat = `@echo off
echo Uninstalling Opersis Assist Agent...

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Run this script as Administrator!
    pause
    exit /b 1
)

sc stop OpersisAssistAgent >nul 2>&1
timeout /t 3 >nul
sc delete OpersisAssistAgent >nul 2>&1

rmdir /s /q "%ProgramFiles%\\OpersisAssist" 2>nul

echo Opersis Assist Agent uninstalled.
pause
`;

  // Stream ZIP response
  const filename = 'opersis-assist-agent-windows.zip';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    res.status(500).json({ error: 'Failed to create archive' });
  });
  archive.pipe(res);

  archive.file(EXE_PATH, { name: 'opersis-assist-agent.exe' });
  archive.append(configJson, { name: 'config.json' });
  archive.append(installBat, { name: 'install.bat' });
  archive.append(uninstallBat, { name: 'uninstall.bat' });
  archive.append(
    'Opersis Assist Agent - Windows\n' +
    '================================\n\n' +
    '1. Extract this ZIP to a folder\n' +
    '2. Right-click install.bat → Run as administrator\n' +
    '3. The agent will install as a Windows service and auto-connect\n\n' +
    'To uninstall: Right-click uninstall.bat → Run as administrator\n',
    { name: 'README.txt' }
  );

  archive.finalize();
});

// GET /api/agent/info
router.get('/info', authenticate, (_req, res) => {
  const exeExists = fs.existsSync(EXE_PATH);
  const exeSize = exeExists ? fs.statSync(EXE_PATH).size : 0;
  res.json({
    platforms: [
      {
        name: 'Windows',
        key: 'windows',
        version: '1.0.0',
        fileSize: exeSize,
        available: exeExists,
        requirements: 'Windows 10/11, Server 2016+',
        downloadUrl: '/api/agent/download/windows',
      },
    ],
  });
});

module.exports = router;
