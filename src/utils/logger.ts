import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: "news-api" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

export function logInfoMessage(message: string, additionalData: object = {}): void {
  logger.info(message, {
    service: "news-api",
    timestamp: new Date().toISOString(),
    ...additionalData,
  });
}

export function logErrorMessage(message: string, error: any, additionalData: object = {}): void {
  logger.error(message, {
    error: error instanceof Error ? error.message : String(error),
    service: "news-api",
    timestamp: new Date().toISOString(),
    ...additionalData,
  });
}

export function logWarningMessage(message: string, error: any, additionalData: object = {}): void {
  logger.warn(message, {
    error: error instanceof Error ? error.message : String(error),
    service: "news-api",
    timestamp: new Date().toISOString(),
    ...additionalData,
  });
}
