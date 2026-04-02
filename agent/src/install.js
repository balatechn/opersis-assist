/**
 * Windows service installer for Opersis Assist Agent
 * Usage: node install.js install | uninstall
 */
const path = require('path');
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'Opersis Assist Agent',
  description: 'Remote Monitoring & Management Agent for Opersis Assist',
  script: path.join(__dirname, 'index.js'),
  nodeOptions: [],
  env: [
    { name: 'NODE_ENV', value: 'production' },
  ],
});

const action = process.argv[2];

if (action === 'install') {
  svc.on('install', () => {
    console.log('Service installed. Starting...');
    svc.start();
  });
  svc.on('alreadyinstalled', () => {
    console.log('Service already installed.');
  });
  svc.on('start', () => {
    console.log('Service started successfully.');
  });
  svc.install();
} else if (action === 'uninstall') {
  svc.on('uninstall', () => {
    console.log('Service uninstalled.');
  });
  svc.uninstall();
} else {
  console.log('Usage: node install.js install | uninstall');
}
