'use strict';
const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

const logsDir = path.join(__dirname, '..', '..', 'data', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const m = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message}${m}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level   : 'error',
      maxsize : 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize : 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
