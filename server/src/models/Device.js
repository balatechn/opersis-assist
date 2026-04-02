const mongoose = require('mongoose');

const systemSnapshotSchema = new mongoose.Schema(
  {
    cpu: { type: Number, default: 0 },
    ram: { total: Number, used: Number, percent: Number },
    disk: { total: Number, used: Number, percent: Number },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hostname: String,
    platform: {
      type: String,
      enum: ['windows', 'linux', 'macos', 'unknown'],
      default: 'unknown',
    },
    osVersion: String,
    agentVersion: String,
    localIp: String,
    publicIp: String,
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    tags: [String],
    group: {
      type: String,
      default: 'default',
    },
    systemInfo: {
      cpuModel: String,
      cpuCores: Number,
      totalRam: Number,
      totalDisk: Number,
    },
    latestStats: systemSnapshotSchema,
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

deviceSchema.index({ isOnline: 1, lastSeen: -1 });
deviceSchema.index({ group: 1 });

module.exports = mongoose.model('Device', deviceSchema);
