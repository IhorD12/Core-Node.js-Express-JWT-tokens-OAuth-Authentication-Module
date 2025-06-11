// src/config/logger.js
/**
 * @fileoverview Winston Logger Configuration.
 * Configures different logging transports based on the environment.
 */
const winston = require('winston');
const { nodeEnv, logLevel: configuredLogLevel } = require('../../config'); // Assuming logLevel will be added to main config

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3, // For morgan-like request logging
  verbose: 4,
  debug: 5,
  silly: 6,
};

const level = () => {
  return configuredLogLevel || (nodeEnv === 'development' ? 'debug' : 'warn');
};

// Format for development: colorized, simple message
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.stack ? '\n' + info.stack : ''}`
  )
);

// Format for production: JSON structured logs
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }), // Log stack trace if an error object is passed
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: nodeEnv === 'production' ? prodFormat : devFormat,
    handleExceptions: true, // Log unhandled exceptions
  }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exitOnError: false, // Do not exit on handled exceptions
});

// Stream for morgan if used (optional)
logger.stream = {
  write: (message) => {
    // Morgan typically adds a newline, remove it for cleaner http logs
    logger.http(message.substring(0, message.lastIndexOf('\n')));
  },
};

module.exports = logger;
