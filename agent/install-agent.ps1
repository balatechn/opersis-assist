#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Opersis Assist Agent - Windows Installer
.DESCRIPTION
    Downloads, configures, and installs the Opersis Assist RMM agent
    as a Windows service on the target machine.
.NOTES
    Run as Administrator: Right-click PowerShell → Run as Administrator
#>

param(
    [string]$ServerUrl = "{{SERVER_URL}}",
    [string]$AgentSecret = "{{AGENT_SECRET}}"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ── Configuration ──
$InstallDir = "$env:ProgramFiles\OpersisAssist"
$DataDir = "$env:ProgramData\OpersisAssist"
$ServiceName = "OpersisAssistAgent"
$NodeVersion = "20.18.1"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"

function Write-Step { param([string]$msg) Write-Host "`n► $msg" -ForegroundColor Cyan }
function Write-OK { param([string]$msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Err { param([string]$msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║       Opersis Assist Agent Installer         ║" -ForegroundColor Magenta
Write-Host "║       Remote Monitoring & Management         ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ── Check admin ──
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Err "This script must be run as Administrator."
    Write-Host "  Right-click PowerShell → Run as Administrator" -ForegroundColor Yellow
    exit 1
}

# ── Stop existing service if running ──
Write-Step "Checking for existing installation..."
$existingSvc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingSvc) {
    Write-Host "  Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    # Remove via nssm or sc
    & sc.exe delete $ServiceName 2>$null | Out-Null
    Start-Sleep -Seconds 1
    Write-OK "Existing service removed"
}

# ── Create directories ──
Write-Step "Creating directories..."
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
Write-OK "Install: $InstallDir"
Write-OK "Data:    $DataDir"

# ── Check / Download Node.js ──
Write-Step "Setting up Node.js runtime..."
$NodeDir = "$InstallDir\node"
$NodeExe = "$NodeDir\node.exe"
$NpmCmd = "$NodeDir\npm.cmd"

if (Test-Path $NodeExe) {
    $ver = & $NodeExe --version 2>$null
    Write-OK "Node.js already installed: $ver"
} else {
    Write-Host "  Downloading Node.js v$NodeVersion..." -ForegroundColor Yellow
    $zipPath = "$env:TEMP\node-v$NodeVersion-win-x64.zip"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $NodeUrl -OutFile $zipPath -UseBasicParsing
    Write-OK "Downloaded Node.js"

    Write-Host "  Extracting..." -ForegroundColor Yellow
    $extractDir = "$env:TEMP\node-extract"
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $extractDir
    $innerDir = Get-ChildItem $extractDir | Select-Object -First 1
    if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force }
    Move-Item -Path $innerDir.FullName -Destination $NodeDir
    Remove-Item $zipPath -Force
    Remove-Item $extractDir -Recurse -Force
    Write-OK "Node.js v$NodeVersion installed"
}

# ── Write agent source files ──
Write-Step "Installing agent files..."

# package.json
@'
{
  "name": "opersis-assist-agent",
  "version": "1.0.0",
  "description": "Opersis Assist RMM - Windows Agent",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "systeminformation": "^5.23.5",
    "uuid": "^10.0.0",
    "ws": "^8.18.0"
  }
}
'@ | Set-Content -Path "$InstallDir\package.json" -Encoding UTF8

# src/config.js
New-Item -ItemType Directory -Path "$InstallDir\src" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\src\collectors" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\src\services" -Force | Out-Null

@"
const path = require('path');
const fs = require('fs');

const configDir = path.join(process.env.PROGRAMDATA || __dirname, 'OpersisAssist');
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

const deviceIdFile = path.join(configDir, 'device-id');
let deviceId;
if (fs.existsSync(deviceIdFile)) {
  deviceId = fs.readFileSync(deviceIdFile, 'utf8').trim();
} else {
  const { v4: uuidv4 } = require('uuid');
  deviceId = uuidv4();
  fs.writeFileSync(deviceIdFile, deviceId);
}

const config = {
  serverUrl: '$ServerUrl',
  agentSecret: '$AgentSecret',
  statsInterval: 5000,
  deviceId,
  agentVersion: '1.0.0',
};

module.exports = config;
"@ | Set-Content -Path "$InstallDir\src\config.js" -Encoding UTF8

# src/index.js
@'
const WebSocket = require('ws');
const config = require('./config');
const { collectSystemInfo, collectStats } = require('./collectors/system');
const { startShell, writeToShell, stopShell } = require('./services/shell');

let ws = null;
let statsTimer = null;
let reconnectTimer = null;
let reconnectDelay = 1000;

function log(level, msg) {
  const ts = new Date().toISOString();
  console[level](`[${ts}] [agent] ${msg}`);
}

async function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  log('info', `Connecting to ${config.serverUrl}...`);

  ws = new WebSocket(config.serverUrl, {
    headers: { 'User-Agent': `OpersisAgent/${config.agentVersion}` },
  });

  ws.on('open', async () => {
    log('info', 'Connected to server');
    reconnectDelay = 1000;
    try {
      const sysInfo = await collectSystemInfo();
      ws.send(JSON.stringify({
        type: 'auth', secret: config.agentSecret, deviceId: config.deviceId,
        hostname: sysInfo.hostname, platform: sysInfo.platform,
        osVersion: sysInfo.osVersion, localIp: sysInfo.localIp,
        agentVersion: config.agentVersion, systemInfo: sysInfo.systemInfo,
      }));
    } catch (err) { log('error', `Auth error: ${err.message}`); }
  });

  ws.on('message', (data) => {
    try { handleServerMessage(JSON.parse(data.toString())); }
    catch (err) { log('error', `Parse error: ${err.message}`); }
  });

  ws.on('close', (code) => {
    log('warn', `Disconnected (code: ${code})`);
    cleanup();
    scheduleReconnect();
  });

  ws.on('error', (err) => { log('error', `WS error: ${err.message}`); });
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'auth_ok': log('info', 'Authenticated'); startStatsReporting(); break;
    case 'ping': send({ type: 'pong' }); break;
    case 'shell_start':
      startShell(msg.sessionId,
        (output) => send({ type: 'shell_output', sessionId: msg.sessionId, data: output }),
        (code) => send({ type: 'shell_output', sessionId: msg.sessionId, data: `\n[Shell exited: ${code}]\n` })
      ); break;
    case 'shell_input': writeToShell(msg.sessionId, msg.data); break;
    case 'shell_stop': stopShell(msg.sessionId); break;
    default: log('warn', `Unknown: ${msg.type}`);
  }
}

function send(msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }

function startStatsReporting() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = setInterval(async () => {
    try { const s = await collectStats(); send({ type: 'stats', ...s }); }
    catch (err) { log('error', `Stats error: ${err.message}`); }
  }, config.statsInterval);
  collectStats().then((s) => send({ type: 'stats', ...s })).catch(() => {});
}

function cleanup() { if (statsTimer) { clearInterval(statsTimer); statsTimer = null; } }

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  log('info', `Reconnecting in ${reconnectDelay / 1000}s...`);
  reconnectTimer = setTimeout(() => { reconnectDelay = Math.min(reconnectDelay * 2, 30000); connect(); }, reconnectDelay);
}

log('info', `Opersis Assist Agent v${config.agentVersion}`);
log('info', `Device ID: ${config.deviceId}`);
connect();

process.on('SIGTERM', () => { cleanup(); if (ws) ws.close(); process.exit(0); });
process.on('SIGINT', () => { cleanup(); if (ws) ws.close(); process.exit(0); });
'@ | Set-Content -Path "$InstallDir\src\index.js" -Encoding UTF8

# src/collectors/system.js
@'
const si = require('systeminformation');
const os = require('os');

async function collectSystemInfo() {
  const [cpu, mem, disk, osInfo] = await Promise.all([
    si.cpu(), si.mem(), si.fsSize(), si.osInfo(),
  ]);
  const nets = os.networkInterfaces();
  let localIp = '0.0.0.0';
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) { localIp = iface.address; break; }
    }
    if (localIp !== '0.0.0.0') break;
  }
  const d = disk[0] || {};
  return {
    hostname: os.hostname(),
    platform: os.platform() === 'win32' ? 'windows' : os.platform(),
    osVersion: `${osInfo.distro} ${osInfo.release}`,
    localIp,
    systemInfo: {
      cpuModel: cpu.brand, cpuCores: cpu.cores,
      totalRam: Math.round(mem.total / 1073741824 * 100) / 100,
      totalDisk: Math.round(d.size / 1073741824 * 100) / 100,
    },
  };
}

async function collectStats() {
  const [cpuLoad, mem, disk] = await Promise.all([si.currentLoad(), si.mem(), si.fsSize()]);
  const d = disk[0] || {};
  return {
    cpu: Math.round(cpuLoad.currentLoad * 100) / 100,
    ram: { total: Math.round(mem.total / 1048576), used: Math.round(mem.used / 1048576), percent: Math.round(mem.used / mem.total * 10000) / 100 },
    disk: { total: Math.round((d.size || 0) / 1048576), used: Math.round((d.used || 0) / 1048576), percent: Math.round((d.use || 0) * 100) / 100 },
  };
}

module.exports = { collectSystemInfo, collectStats };
'@ | Set-Content -Path "$InstallDir\src\collectors\system.js" -Encoding UTF8

# src/services/shell.js
@'
const { spawn } = require('child_process');
const os = require('os');
const sessions = new Map();

function startShell(sessionId, onData, onClose) {
  const proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile'], { env: process.env, cwd: os.homedir() });
  const session = { process: proc, alive: true };
  sessions.set(sessionId, session);
  proc.stdout.on('data', (d) => onData(d.toString()));
  proc.stderr.on('data', (d) => onData(d.toString()));
  proc.on('close', (code) => { session.alive = false; sessions.delete(sessionId); onClose(code); });
  proc.on('error', (err) => { onData(`[Error] ${err.message}\n`); session.alive = false; sessions.delete(sessionId); });
  return session;
}

function writeToShell(sessionId, data) { const s = sessions.get(sessionId); if (s && s.alive) s.process.stdin.write(data); }
function stopShell(sessionId) { const s = sessions.get(sessionId); if (s && s.alive) { s.process.kill(); sessions.delete(sessionId); } }

module.exports = { startShell, writeToShell, stopShell };
'@ | Set-Content -Path "$InstallDir\src\services\shell.js" -Encoding UTF8

Write-OK "Agent source files written"

# ── Install npm dependencies ──
Write-Step "Installing dependencies (this may take a minute)..."
$env:PATH = "$NodeDir;$($env:PATH)"
Push-Location $InstallDir
& $NpmCmd install --production 2>&1 | Out-Null
Pop-Location
Write-OK "Dependencies installed"

# ── Download and setup NSSM (service manager) ──
Write-Step "Setting up Windows service..."
$NssmDir = "$InstallDir\nssm"
$NssmExe = "$NssmDir\nssm.exe"

if (-not (Test-Path $NssmExe)) {
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
    $nssmExtract = "$env:TEMP\nssm-extract"
    if (Test-Path $nssmExtract) { Remove-Item $nssmExtract -Recurse -Force }
    Expand-Archive -Path $nssmZip -DestinationPath $nssmExtract
    New-Item -ItemType Directory -Path $NssmDir -Force | Out-Null
    Copy-Item -Path "$nssmExtract\nssm-2.24\win64\nssm.exe" -Destination $NssmExe
    Remove-Item $nssmZip -Force
    Remove-Item $nssmExtract -Recurse -Force
    Write-OK "NSSM service manager installed"
}

# ── Register Windows service ──
& $NssmExe install $ServiceName $NodeExe "$InstallDir\src\index.js" 2>$null | Out-Null
& $NssmExe set $ServiceName AppDirectory $InstallDir 2>$null | Out-Null
& $NssmExe set $ServiceName DisplayName "Opersis Assist Agent" 2>$null | Out-Null
& $NssmExe set $ServiceName Description "Remote Monitoring & Management Agent" 2>$null | Out-Null
& $NssmExe set $ServiceName Start SERVICE_AUTO_START 2>$null | Out-Null
& $NssmExe set $ServiceName AppStdout "$DataDir\agent.log" 2>$null | Out-Null
& $NssmExe set $ServiceName AppStderr "$DataDir\agent-error.log" 2>$null | Out-Null
& $NssmExe set $ServiceName AppRotateFiles 1 2>$null | Out-Null
& $NssmExe set $ServiceName AppRotateBytes 5242880 2>$null | Out-Null
Write-OK "Windows service registered"

# ── Start the service ──
Write-Step "Starting agent service..."
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3
$svc = Get-Service -Name $ServiceName
if ($svc.Status -eq 'Running') {
    Write-OK "Agent service is running!"
} else {
    Write-Err "Service failed to start. Check logs at: $DataDir\agent-error.log"
}

# ── Create uninstaller ──
@"
#Requires -RunAsAdministrator
Write-Host 'Uninstalling Opersis Assist Agent...' -ForegroundColor Yellow
Stop-Service -Name '$ServiceName' -Force -ErrorAction SilentlyContinue
& '$NssmExe' remove '$ServiceName' confirm 2>`$null | Out-Null
Start-Sleep -Seconds 2
Remove-Item -Path '$InstallDir' -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Opersis Assist Agent uninstalled.' -ForegroundColor Green
"@ | Set-Content -Path "$DataDir\uninstall.ps1" -Encoding UTF8

# ── Done ──
Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║    Opersis Assist Agent Installed!            ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Service Name : $ServiceName" -ForegroundColor White
Write-Host "  Install Dir  : $InstallDir" -ForegroundColor White
Write-Host "  Data Dir     : $DataDir" -ForegroundColor White
Write-Host "  Logs         : $DataDir\agent.log" -ForegroundColor White
Write-Host "  Uninstall    : powershell -File `"$DataDir\uninstall.ps1`"" -ForegroundColor White
Write-Host ""
Write-Host "  The agent will auto-connect to:" -ForegroundColor Yellow
Write-Host "  $ServerUrl" -ForegroundColor Yellow
Write-Host ""
