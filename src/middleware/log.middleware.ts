import { type NextFunction, type Request, type Response } from 'express';
import winston from 'winston';
import { AppConfig } from '../app.config';
import { SeqTransport } from '@datalust/winston-seq';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.json()),
  defaultMeta: {
    application: 'panthor-stream-overlay',
    environment: AppConfig.environment.toString(),
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    ...(AppConfig.environment === 'PROD'
      ? [
          new SeqTransport({
            serverUrl: AppConfig.log.apiUrl,
            apiKey: AppConfig.log.apiKey,
            onError: (e) => console.error(e),
            handleExceptions: true,
            handleRejections: true,
          }),
        ]
      : []),
  ],
});

export enum LogCategory {
  Setup = 'Setup',
  AuthCode = 'Auth-Code',
  AccessToken = 'Access-Token',
  RefreshingAuthProvider = 'RefreshingAuthProvider',
  EventListener = 'Event-Listener',
  ChatBot = 'Chatbot',
  ChatMessage = 'Message',
  DiscordNotification = 'Discord Notification',
}

export function logMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('favicon') || req.path === '/status') return next();
  res.on('finish', async () => {
    logger.info('Processed a request with status code {code}', {
      code: res.statusCode.toString(),
      method: req.method,
      ip: req.ip,
      location: req.originalUrl,
      body: req.body,
      query: req.query,
      header: { authorization: req.headers.authorization },
    });
  });
  next();
}
