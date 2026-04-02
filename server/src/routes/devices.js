const express = require('express');
const Device = require('../models/Device');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/devices — list all devices
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { group, online, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (group) filter.group = group;
    if (online !== undefined) filter.isOnline = online === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { hostname: { $regex: search, $options: 'i' } },
        { deviceId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [devices, total] = await Promise.all([
      Device.find(filter).sort({ isOnline: -1, lastSeen: -1 }).skip(skip).limit(parseInt(limit)),
      Device.countDocuments(filter),
    ]);

    res.json({
      devices,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/devices/stats — summary stats
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const [total, online, offline] = await Promise.all([
      Device.countDocuments(),
      Device.countDocuments({ isOnline: true }),
      Device.countDocuments({ isOnline: false }),
    ]);

    const platformCounts = await Device.aggregate([
      { $group: { _id: '$platform', count: { $sum: 1 } } },
    ]);

    res.json({ total, online, offline, platforms: platformCounts });
  } catch (error) {
    next(error);
  }
});

// GET /api/devices/:id — single device details
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.id });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({ device });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/devices/:id — update device metadata
router.patch('/:id', authenticate, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const { name, group, tags } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (group) updates.group = group;
    if (tags) updates.tags = tags;

    const device = await Device.findOneAndUpdate({ deviceId: req.params.id }, updates, { new: true });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    res.json({ device });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/devices/:id — remove a device
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const device = await Device.findOneAndDelete({ deviceId: req.params.id });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({ message: 'Device removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
