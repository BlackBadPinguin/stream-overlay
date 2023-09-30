import type { NextFunction, Request, Response } from 'express';
import { AppConfig } from '../app.config';

export function secure(password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (AppConfig.environment === 'DEV') return next();
    const pwd = req.query.password;
    if (!pwd) {
      return res.status(401).json({ message: "Provide an 'password' query-parameter" });
    }

    if (pwd !== password) {
      return res.status(401).json({ message: 'Provided password is invalid' });
    }

    next();
  };
}
