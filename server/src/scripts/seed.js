/**
 * Seed script: Creates the initial super-admin user if none exists.
 * The admin credentials are read from environment variables:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 *
 * Run: node src/scripts/seed.js
 * Or: automatically on first server start via src/index.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@opersis.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

async function seed() {
  // If mongoose is not connected yet (standalone run), connect ourselves
  const needsConnect = mongoose.connection.readyState === 0;
  try {
    if (needsConnect) {
      await mongoose.connect(config.mongodb.uri, {
        maxPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
      });
    }

    const count = await User.countDocuments();
    if (count > 0) {
      console.log(`[seed] ${count} user(s) already exist — skipping seed.`);
      if (needsConnect) await mongoose.disconnect();
      return;
    }

    if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
      console.error('[seed] ADMIN_PASSWORD env var must be set (min 8 chars) for initial seed.');
      if (needsConnect) await mongoose.disconnect();
      process.exit(1);
    }

    const admin = await User.create({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      role: 'admin',
      isActive: true,
    });

    console.log(`[seed] Super-admin created: ${admin.email} (role: admin)`);
    if (needsConnect) await mongoose.disconnect();
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    if (needsConnect) await mongoose.disconnect();
    process.exit(1);
  }
}

// If run directly
if (require.main === module) {
  seed();
}

module.exports = seed;
