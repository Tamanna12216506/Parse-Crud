const jwt = require('jsonwebtoken');

module.exports = function optionalAuth(required = false) {
  return function (req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth) {
      if (required) return res.status(401).json({ error: 'Missing Authorization header' });
      return next();
    }
    const token = auth.split(' ')[1];
    if (!token) {
      if (required) return res.status(401).json({ error: 'Invalid Authorization header' });
      return next();
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = payload;
      next();
    } catch (err) {
      if (required) return res.status(401).json({ error: 'Invalid token' });
      next();
    }
  }
}
