const path = require('path');
const fs = require('fs');

// Load .env if present
const envPath = path.join(__dirname, '..', '.env');
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
const configDir = path.join(process.env.PROGRAMDATA || path.join(__dirname, '..'), 'OpersisAssist');
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
  serverUrl: process.env.SERVER_URL || 'ws://localhost:4000/ws/agent',
  agentSecret: process.env.AGENT_SECRET || 'dev-agent-secret-change-in-production',
  statsInterval: parseInt(process.env.STATS_INTERVAL, 10) || 5000,
  deviceId,
  agentVersion: '1.0.0',
};

module.exports = config;
