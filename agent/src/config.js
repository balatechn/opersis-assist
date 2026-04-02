const path = require('path');
const fs = require('fs');

// Detect if running as a pkg-compiled exe
const isPkg = typeof process.pkg !== 'undefined';
const exeDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Load config.json next to the exe (standalone mode)
const configJsonPath = path.join(exeDir, 'config.json');
let fileConfig = {};
if (fs.existsSync(configJsonPath)) {
  try { fileConfig = JSON.parse(fs.readFileSync(configJsonPath, 'utf8')); } catch {}
}

// Load .env if present (dev mode)
const envPath = path.join(exeDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

// Persistent device ID
const configDir = path.join(process.env.PROGRAMDATA || exeDir, 'OpersisAssist');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

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
  serverUrl: fileConfig.serverUrl || process.env.SERVER_URL || 'ws://localhost:4000/ws/agent',
  agentSecret: fileConfig.agentSecret || process.env.AGENT_SECRET || 'dev-agent-secret-change-in-production',
  statsInterval: parseInt(fileConfig.statsInterval || process.env.STATS_INTERVAL, 10) || 5000,
  deviceId,
  agentVersion: '1.0.0',
};

module.exports = config;
