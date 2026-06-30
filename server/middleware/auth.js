const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided.' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const requireHR = (req, res, next) => {
  const u = req.user;
  if (!['hr_admin','owner'].includes(u?.role) && !u?.isHrAdmin)
    return res.status(403).json({ message: 'HR access required.' });
  next();
};

const requireOwner = (req, res, next) => {
  if (req.user?.role !== 'owner')
    return res.status(403).json({ message: 'Owner access required.' });
  next();
};

const requireEmployee = (req, res, next) => {
  if (req.user?.role !== 'employee')
    return res.status(403).json({ message: 'Employee access required.' });
  next();
};

module.exports = { authenticate, requireHR, requireOwner, requireEmployee };
