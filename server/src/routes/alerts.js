const express = require('express');
const Alert = require('../models/Alert');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts — list alerts
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { acknowledged, severity, type, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';
    if (severity) filter.severity = severity;
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .populate('device', 'name hostname deviceId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Alert.countDocuments(filter),
    ]);

    res.json({
      alerts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/alerts/:id/acknowledge
router.patch('/:id/acknowledge', authenticate, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        acknowledged: true,
        acknowledgedBy: req.user._id,
        acknowledgedAt: new Date(),
      },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ alert });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
