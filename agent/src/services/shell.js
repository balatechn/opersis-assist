const { spawn } = require('child_process');
const os = require('os');

// Active shell sessions: sessionId -> { process, alive }
const sessions = new Map();

function startShell(sessionId, onData, onClose) {
  const shell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash';
  const args = os.platform() === 'win32' ? ['-NoLogo', '-NoProfile'] : [];

  const proc = spawn(shell, args, {
    env: process.env,
    cwd: os.homedir(),
  });

  const session = { process: proc, alive: true };
  sessions.set(sessionId, session);

  proc.stdout.on('data', (data) => {
    onData(data.toString());
  });

  proc.stderr.on('data', (data) => {
    onData(data.toString());
  });

  proc.on('close', (code) => {
    session.alive = false;
    sessions.delete(sessionId);
    onClose(code);
  });

  proc.on('error', (err) => {
    onData(`[Shell Error] ${err.message}\n`);
    session.alive = false;
    sessions.delete(sessionId);
  });

  return session;
}

function writeToShell(sessionId, data) {
  const session = sessions.get(sessionId);
  if (session && session.alive) {
    session.process.stdin.write(data);
  }
}

function stopShell(sessionId) {
  const session = sessions.get(sessionId);
  if (session && session.alive) {
    session.process.kill();
    sessions.delete(sessionId);
  }
}

module.exports = { startShell, writeToShell, stopShell };
