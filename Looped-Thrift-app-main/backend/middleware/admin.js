const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check admin role or superadmin fallback
    const isAdmin = user.role === 'admin' || user.email.includes('admin@looped.app');
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin privileges required.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(500).json({ message: 'Server authorization error' });
  }
};
