const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/agent/download/windows
// Returns a PowerShell installer script with server URL & agent secret pre-configured
router.get('/download/windows', authenticate, requireRole('admin', 'operator'), (req, res) => {
  const templatePath = path.join(__dirname, '..', '..', 'agent-installer', 'install-agent.ps1');

  let script;
  if (fs.existsSync(templatePath)) {
    script = fs.readFileSync(templatePath, 'utf8');
  } else {
    // Fallback: read from the agent directory in the repo
    const fallbackPath = path.join(__dirname, '..', '..', '..', 'agent', 'install-agent.ps1');
    if (!fs.existsSync(fallbackPath)) {
      return res.status(404).json({ error: 'Installer template not found' });
    }
    script = fs.readFileSync(fallbackPath, 'utf8');
  }

  // Determine the public-facing server WebSocket URL
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const wsProto = proto === 'https' ? 'wss' : 'ws';
  const wsUrl = process.env.WS_URL || `${wsProto}://${host}/ws/agent`;

  // Replace placeholders with real values
  script = script
    .replace(/\{\{SERVER_URL\}\}/g, wsUrl)
    .replace(/\{\{AGENT_SECRET\}\}/g, config.agent.secret);

  const filename = `opersis-assist-agent-installer.ps1`;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', Buffer.byteLength(script, 'utf8'));
  res.send(script);
});

// GET /api/agent/info
// Returns agent metadata (no auth required for the info, but auth for download)
router.get('/info', authenticate, (_req, res) => {
  res.json({
    platforms: [
      {
        name: 'Windows',
        key: 'windows',
        version: '1.0.0',
        requirements: 'Windows 10/11, Server 2016+',
        downloadUrl: '/api/agent/download/windows',
        instructions: 'Run as Administrator in PowerShell',
      },
    ],
  });
});

module.exports = router;
