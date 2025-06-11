// src/config/logger.ts
/**
 * @fileoverview Winston Logger Configuration.
 * Configures different logging transports based on the environment.
 */
import winston, { format, transports, Logger } from 'winston';
import config from '@config/index'; // Use path alias from tsconfig.json

const { nodeEnv, logLevel: configuredLogLevel } = config;

interface LogLevels extends winston.LoggerOptions {
  levels: { [key: string]: number }; // For custom levels if needed, or use standard
}

const levels: { [key: string]: number } = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const currentLevel = (): string => {
  return configuredLogLevel || (nodeEnv === 'development' ? 'debug' : 'warn');
};

// Format for development: colorized, simple message
const devFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.colorize({ all: true }),
  format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.stack ? '\\n' + info.stack : ''}`
  )
);

// Format for production: JSON structured logs
const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }), // Log stack trace if an error object is passed
  format.json()
);

const consoleTransport = new transports.Console({
  format: nodeEnv === 'production' ? prodFormat : devFormat,
  handleExceptions: true, // Log unhandled exceptions
});

const logger: Logger = winston.createLogger({
  level: currentLevel(),
  levels, // Use standard syslog levels by default, or custom 'levels' object
  transports: [consoleTransport],
  exitOnError: false, // Do not exit on handled exceptions
});

// Stream for morgan if used (optional)
// Define a custom type for the stream object if needed for strictness
interface LoggerStream {
  write: (message: string) => void;
}

(logger as Logger & { stream: LoggerStream }).stream = {
  write: (message: string): void => {
    logger.http(message.substring(0, message.lastIndexOf('\n')));
  },
};

export default logger as Logger & { stream: LoggerStream };
