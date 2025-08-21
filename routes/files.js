const router = require('express').Router();
const FilesController = require('../services/files.controller');
const optionalAuth = require('../middlewares/auth');

// Upload (protected)
router.post('/', optionalAuth(true), FilesController.upload);

// Progress
router.get('/:id/progress', optionalAuth(false), FilesController.progress);

// SSE stream for progress
router.get('/:id/stream', optionalAuth(false), FilesController.progressStream);

// Get parsed content
router.get('/:id', optionalAuth(false), FilesController.getFile);

// List files
router.get('/', optionalAuth(false), FilesController.listFiles);

// Delete file
router.delete('/:id', optionalAuth(true), FilesController.deleteFile);

module.exports = router;
