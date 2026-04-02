const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['cpu_spike', 'ram_spike', 'disk_critical', 'offline', 'agent_error'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
    },
    message: {
      type: String,
      required: true,
    },
    value: Number,
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: Date,
    resolvedAt: Date,
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ device: 1, createdAt: -1 });
alertSchema.index({ acknowledged: 1, severity: 1 });

module.exports = mongoose.model('Alert', alertSchema);
