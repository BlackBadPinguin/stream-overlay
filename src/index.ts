import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { AppConfig } from './app.config';
import { logMiddleware } from './middleware';
import path from 'path';

/**
 * Check if all required environment-variables are set
 */
const MISSING_ENVIRONMENT_VARIABLES = AppConfig.environmentVariables.filter((variable) => {
  if (!process.env[variable]) {
    return variable;
  }
});
if (MISSING_ENVIRONMENT_VARIABLES.length >= 1) {
  console.log(
    'ERROR',
    'Starting',
    JSON.stringify({
      missing: MISSING_ENVIRONMENT_VARIABLES,
      error: 'server/missing-environment-variables',
    })
  );
  process.exit();
}

const app = express();
const server = http.createServer(app);

app.use(logMiddleware);
app.use('/static', express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Overlay reachable' });
});

server.listen(AppConfig.port, async () => {
  console.log('Server listening on localhost:' + AppConfig.port);
});
