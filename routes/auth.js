const router = require('express').Router();
const jwt = require('jsonwebtoken');

// Demo login: accepts any username, returns JWT
router.post('/login', (req, res) => {
  const { username = 'demo' } = req.body || {};
  const token = jwt.sign({ sub: username }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
  res.json({ token });
});

module.exports = router;
