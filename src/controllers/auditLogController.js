import ActivityLog from '../models/ActivityLog.js';

export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
    const search = String(req.query.search || '').trim();
    const filter = search ? {
      $or: [
        { actionType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { entityType: { $regex: search, $options: 'i' } },
      ],
    } : {};

    const [items, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    return res.json({
      data: items,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return res.status(500).json({ message: 'Failed to load audit logs' });
  }
};
