const WebSocket = require('ws');
const config = require('../config');
const { collectSystemInfo, collectStats } = require('../collectors/system');
const { startShell, writeToShell, stopShell } = require('../services/shell');

let ws = null;
let statsTimer = null;
let reconnectTimer = null;
let reconnectDelay = 1000;

function log(level, msg) {
  const ts = new Date().toISOString();
  console[level](`[${ts}] [agent] ${msg}`);
}

async function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

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
        type: 'auth',
        secret: config.agentSecret,
        deviceId: config.deviceId,
        hostname: sysInfo.hostname,
        platform: sysInfo.platform,
        osVersion: sysInfo.osVersion,
        localIp: sysInfo.localIp,
        agentVersion: config.agentVersion,
        systemInfo: sysInfo.systemInfo,
      }));
    } catch (err) {
      log('error', `Failed to collect system info: ${err.message}`);
    }
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleServerMessage(msg);
    } catch (err) {
      log('error', `Message parse error: ${err.message}`);
    }
  });

  ws.on('close', (code, reason) => {
    log('warn', `Disconnected (code: ${code}, reason: ${reason || 'none'})`);
    cleanup();
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    log('error', `WebSocket error: ${err.message}`);
  });
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'auth_ok':
      log('info', 'Authenticated successfully');
      startStatsReporting();
      break;

    case 'ping':
      send({ type: 'pong' });
      break;

    case 'shell_start':
      log('info', `Shell session started: ${msg.sessionId}`);
      startShell(
        msg.sessionId,
        (output) => {
          send({ type: 'shell_output', sessionId: msg.sessionId, data: output });
        },
        (code) => {
          send({ type: 'shell_output', sessionId: msg.sessionId, data: `\n[Shell exited with code ${code}]\n` });
        }
      );
      break;

    case 'shell_input':
      writeToShell(msg.sessionId, msg.data);
      break;

    case 'shell_stop':
      stopShell(msg.sessionId);
      break;

    default:
      log('warn', `Unknown message type: ${msg.type}`);
  }
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function startStatsReporting() {
  if (statsTimer) clearInterval(statsTimer);

  statsTimer = setInterval(async () => {
    try {
      const stats = await collectStats();
      send({ type: 'stats', ...stats });
    } catch (err) {
      log('error', `Stats collection error: ${err.message}`);
    }
  }, config.statsInterval);

  // Send first report immediately
  collectStats().then((stats) => send({ type: 'stats', ...stats })).catch(() => {});
}

function cleanup() {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  log('info', `Reconnecting in ${reconnectDelay / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

// ── Entry point ──
log('info', `Opersis Assist Agent v${config.agentVersion}`);
log('info', `Device ID: ${config.deviceId}`);
connect();

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Shutting down...');
  cleanup();
  if (ws) ws.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Shutting down...');
  cleanup();
  if (ws) ws.close();
  process.exit(0);
});
