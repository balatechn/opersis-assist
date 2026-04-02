const si = require('systeminformation');
const os = require('os');

async function collectSystemInfo() {
  const [cpu, mem, disk, osInfo, networkInterfaces] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
    si.networkInterfaces(),
  ]);

  // Find primary non-internal IP
  const nets = os.networkInterfaces();
  let localIp = '0.0.0.0';
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== '0.0.0.0') break;
  }

  const primaryDisk = disk[0] || {};

  return {
    hostname: os.hostname(),
    platform: os.platform() === 'win32' ? 'windows' : os.platform() === 'darwin' ? 'macos' : 'linux',
    osVersion: `${osInfo.distro} ${osInfo.release}`,
    localIp,
    systemInfo: {
      cpuModel: cpu.brand,
      cpuCores: cpu.cores,
      totalRam: Math.round(mem.total / (1024 * 1024 * 1024) * 100) / 100,
      totalDisk: Math.round(primaryDisk.size / (1024 * 1024 * 1024) * 100) / 100,
    },
  };
}

async function collectStats() {
  const [cpuLoad, mem, disk] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
  ]);

  const primaryDisk = disk[0] || {};

  return {
    cpu: Math.round(cpuLoad.currentLoad * 100) / 100,
    ram: {
      total: Math.round(mem.total / (1024 * 1024)),
      used: Math.round(mem.used / (1024 * 1024)),
      percent: Math.round((mem.used / mem.total) * 10000) / 100,
    },
    disk: {
      total: Math.round((primaryDisk.size || 0) / (1024 * 1024)),
      used: Math.round((primaryDisk.used || 0) / (1024 * 1024)),
      percent: Math.round((primaryDisk.use || 0) * 100) / 100,
    },
  };
}

module.exports = { collectSystemInfo, collectStats };
