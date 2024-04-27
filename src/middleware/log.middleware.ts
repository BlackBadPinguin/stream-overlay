import { type NextFunction, type Request, type Response } from 'express';
import winston from 'winston';
import { BaselimeTransport } from '@baselime/winston-transport';
import { AppConfig } from '../app.config';
import { requestLogger } from '../index';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.json()),
  defaultMeta: {
    environment: AppConfig.environment.toString(),
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    ...(AppConfig.log.apiKey !== undefined
      ? [
          new BaselimeTransport({
            baselimeApiKey: process.env.BASELIME_API_KEY,
            service: 'stream-overlay',
            dataset: 'stream-overlay',
            namespace: 'de.panthor.stream-overlay',
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
    requestLogger.info('Processed a request with status code {code}', {
      namespace: req.path,
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
