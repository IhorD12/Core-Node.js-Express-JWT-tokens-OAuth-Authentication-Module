// src/routes/healthRoutes.js
/**
 * @fileoverview Health check endpoint.
 */
const express = require('express');
const router = express.Router();
const logger = require('../../config/logger');

/**
 * @route GET /health
 * @description Basic health check endpoint to verify the API is running.
 * @access Public
 */
router.get('/', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
  };
  try {
    // logger.info('Health check successful.'); // Can be too verbose for frequent checks
    res.status(200).json(healthCheck);
  } catch (e) {
    healthCheck.message = e.message;
    logger.error('Health check failed:', e);
    res.status(500).json(healthCheck);
  }
});

module.exports = router;
