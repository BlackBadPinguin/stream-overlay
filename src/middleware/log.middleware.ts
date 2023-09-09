import { type NextFunction, type Request,type Response } from 'express';

export function logMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.path.includes('favicon') || req.path === '/status') return next();
    res.on('finish', async () => {
        const statusCode = res.statusCode;
        const type =
            statusCode >= 200 && statusCode < 400 ? 'LOG' : statusCode >= 400 && statusCode < 500 ? 'WARN' : 'ERROR';
        const category = res.statusCode.toString();
        const message = {
            method: req.method,
            ip: req.ip,
            location: req.originalUrl,
            body: req.body,
            query: req.query,
            header: { authorization: req.headers.authorization },
        };

        console.log(`[${type}:${new Date().toISOString()}] (${category}) ${JSON.stringify(message)}`);
    });
    next();
}