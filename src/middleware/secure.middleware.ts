import type { NextFunction, Request, Response } from 'express';

export function secure(password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
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
