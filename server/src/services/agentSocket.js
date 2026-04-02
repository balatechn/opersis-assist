const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Device = require('../models/Device');
const Alert = require('../models/Alert');
const logger = require('./logger');

// Active agent connections: deviceId -> ws
const agentConnections = new Map();
// Active dashboard watchers: userId -> Set<ws>
const dashboardClients = new Map();

function initAgentSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/ws/agent') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (url.pathname === '/ws/dashboard') {
      handleDashboardUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    let authenticatedDeviceId = null;
    let heartbeatTimer = null;

    // Expect authentication within 10 seconds
    const authTimeout = setTimeout(() => {
      if (!authenticatedDeviceId) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 10000);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleAgentMessage(ws, msg, {
          get deviceId() { return authenticatedDeviceId; },
          set deviceId(v) { authenticatedDeviceId = v; },
          authTimeout,
          heartbeatTimer,
          set heartbeat(t) { heartbeatTimer = t; },
        });
      } catch (err) {
        logger.error('Agent message parse error:', err.message);
      }
    });

    ws.on('close', async () => {
      clearTimeout(authTimeout);
      clearTimeout(heartbeatTimer);
      if (authenticatedDeviceId) {
        agentConnections.delete(authenticatedDeviceId);
        await Device.findOneAndUpdate(
          { deviceId: authenticatedDeviceId },
          { isOnline: false, lastSeen: new Date() }
        );
        broadcastToDashboard({
          type: 'device.status',
          deviceId: authenticatedDeviceId,
          isOnline: false,
          lastSeen: new Date(),
        });
        logger.info(`Agent disconnected: ${authenticatedDeviceId}`);
      }
    });

    ws.on('error', (err) => {
      logger.error('Agent WS error:', err.message);
    });
  });

  logger.info('Agent WebSocket server initialized');
  return wss;
}

async function handleAgentMessage(ws, msg, ctx) {
  switch (msg.type) {
    case 'auth': {
      // Verify agent secret + deviceId
      if (msg.secret !== config.agent.secret) {
        ws.close(4003, 'Invalid agent secret');
        return;
      }
      if (!msg.deviceId || !msg.hostname) {
        ws.close(4004, 'Missing device info');
        return;
      }

      clearTimeout(ctx.authTimeout);
      ctx.deviceId = msg.deviceId;
      agentConnections.set(msg.deviceId, ws);

      // Upsert device record
      await Device.findOneAndUpdate(
        { deviceId: msg.deviceId },
        {
          deviceId: msg.deviceId,
          name: msg.hostname,
          hostname: msg.hostname,
          platform: msg.platform || 'unknown',
          osVersion: msg.osVersion || '',
          agentVersion: msg.agentVersion || '1.0.0',
          localIp: msg.localIp || '',
          isOnline: true,
          lastSeen: new Date(),
          systemInfo: msg.systemInfo || {},
        },
        { upsert: true, new: true }
      );

      broadcastToDashboard({
        type: 'device.status',
        deviceId: msg.deviceId,
        isOnline: true,
        hostname: msg.hostname,
      });

      ws.send(JSON.stringify({ type: 'auth_ok' }));
      logger.info(`Agent authenticated: ${msg.deviceId} (${msg.hostname})`);

      // Start heartbeat
      ctx.heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      break;
    }

    case 'stats': {
      if (!ctx.deviceId) return;

      const device = await Device.findOneAndUpdate(
        { deviceId: ctx.deviceId },
        {
          lastSeen: new Date(),
          latestStats: {
            cpu: msg.cpu,
            ram: msg.ram,
            disk: msg.disk,
            timestamp: new Date(),
          },
        },
        { new: true }
      );

      // Check for alert thresholds
      if (msg.cpu > 90) {
        await createAlert(device, 'cpu_spike', 'critical', `CPU usage at ${msg.cpu}%`, msg.cpu);
      }
      if (msg.ram?.percent > 95) {
        await createAlert(device, 'ram_spike', 'warning', `RAM usage at ${msg.ram.percent}%`, msg.ram.percent);
      }
      if (msg.disk?.percent > 90) {
        await createAlert(device, 'disk_critical', 'critical', `Disk usage at ${msg.disk.percent}%`, msg.disk.percent);
      }

      broadcastToDashboard({
        type: 'device.stats',
        deviceId: ctx.deviceId,
        stats: { cpu: msg.cpu, ram: msg.ram, disk: msg.disk },
      });
      break;
    }

    case 'shell_output': {
      // Forward shell output to the requesting dashboard client
      if (msg.sessionId) {
        broadcastToDashboard({
          type: 'shell.output',
          deviceId: ctx.deviceId,
          sessionId: msg.sessionId,
          data: msg.data,
        });
      }
      break;
    }

    case 'pong':
      // Heartbeat response, device is alive
      break;

    default:
      logger.warn(`Unknown agent message type: ${msg.type}`);
  }
}

async function createAlert(device, type, severity, message, value) {
  if (!device) return;
  // Avoid duplicate alerts within 5 minutes
  const recent = await Alert.findOne({
    deviceId: device.deviceId,
    type,
    createdAt: { $gte: new Date(Date.now() - 5 * 60000) },
  });
  if (recent) return;

  const alert = await Alert.create({
    device: device._id,
    deviceId: device.deviceId,
    type,
    severity,
    message,
    value,
  });

  broadcastToDashboard({ type: 'alert.new', alert });
}

// ── Dashboard WebSocket ──

const dashboardWss = new WebSocketServer({ noServer: true });

function handleDashboardUpgrade(request, socket, head) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    dashboardWss.handleUpgrade(request, socket, head, (ws) => {
      ws.userId = decoded.userId;
      dashboardWss.emit('connection', ws);
    });
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
}

dashboardWss.on('connection', (ws) => {
  const userId = ws.userId;
  if (!dashboardClients.has(userId)) {
    dashboardClients.set(userId, new Set());
  }
  dashboardClients.get(userId).add(ws);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleDashboardCommand(ws, msg);
    } catch (err) {
      logger.error('Dashboard message error:', err.message);
    }
  });

  ws.on('close', () => {
    const clients = dashboardClients.get(userId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) dashboardClients.delete(userId);
    }
  });
});

function handleDashboardCommand(ws, msg) {
  switch (msg.type) {
    case 'shell.start': {
      const agentWs = agentConnections.get(msg.deviceId);
      if (!agentWs || agentWs.readyState !== agentWs.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'Device is offline' }));
        return;
      }
      const sessionId = crypto.randomUUID();
      agentWs.send(JSON.stringify({ type: 'shell_start', sessionId }));
      ws.send(JSON.stringify({ type: 'shell.started', sessionId, deviceId: msg.deviceId }));
      break;
    }

    case 'shell.input': {
      const agentWs = agentConnections.get(msg.deviceId);
      if (agentWs && agentWs.readyState === agentWs.OPEN) {
        agentWs.send(JSON.stringify({
          type: 'shell_input',
          sessionId: msg.sessionId,
          data: msg.data,
        }));
      }
      break;
    }

    case 'shell.stop': {
      const agentWs = agentConnections.get(msg.deviceId);
      if (agentWs && agentWs.readyState === agentWs.OPEN) {
        agentWs.send(JSON.stringify({ type: 'shell_stop', sessionId: msg.sessionId }));
      }
      break;
    }
  }
}

function broadcastToDashboard(message) {
  const data = JSON.stringify(message);
  for (const [, clients] of dashboardClients) {
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }
}

function getAgentConnection(deviceId) {
  return agentConnections.get(deviceId);
}

function getOnlineAgentCount() {
  return agentConnections.size;
}

module.exports = {
  initAgentSocket,
  getAgentConnection,
  getOnlineAgentCount,
  broadcastToDashboard,
};
