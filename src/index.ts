import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { AppConfig } from './app.config';
import { LogCategory, log, logMiddleware, secure } from './middleware';
import { AuthManager, emit } from './core';

/**
 * Check if all required environment-variables are set
 */
const MISSING_ENVIRONMENT_VARIABLES = AppConfig.environmentVariables.filter((variable) => {
  if (!process.env[variable]) {
    return variable;
  }
});
if (MISSING_ENVIRONMENT_VARIABLES.length >= 1) {
  log(
    'ERROR',
    LogCategory.Setup,
    JSON.stringify({
      missing: MISSING_ENVIRONMENT_VARIABLES,
      error: 'server/missing-environment-variables',
    })
  );
  process.exit();
}

export const CLIENT_ID = process.env.CLIENT_ID as string;
export const CLIENT_SECRET = process.env.CLIENT_SECRET as string;
export const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL as string;
export const TWITCH_CHANNEL_ID = process.env.TWITCH_CHANNEL_ID as string;
export const ENDPOINT_PASSWORD = process.env.ENDPOINT_PASSWORD as string;

console.table({ CLIENT_ID, CLIENT_SECRET, TWITCH_CHANNELS: TWITCH_CHANNEL, TWITCH_CHANNELS_ID: TWITCH_CHANNEL_ID });

const app = express();
const server = http.createServer(app);
export const io = new Server(server);

app.use(logMiddleware);
app.use('/static', express.static(path.join(__dirname, '../public')));

app.get('/', async (req, res) => {
  const code = req.query.code,
    scope = req.query.scope;
  if (!code) return res.json({ message: 'code is not provided' });
  if (!scope) return res.json({ message: 'scope is not provided' });

  AuthManager.getInstance().setCode(code as string);
  log('INFO', LogCategory.AuthCode, code);

  const [accessToken, error] = await AuthManager.getInstance().obtainAccessToken(CLIENT_ID, CLIENT_SECRET);
  if (error) {
    log('ERROR', LogCategory.AccessToken, error);
    return res.json({ message: "Couldn't retrieve an access-token" });
  }
  if (!accessToken) return res.json({ message: 'Received an empty access-token' });
  AuthManager.getInstance().setAccessToken(accessToken);

  return res.json({ code, scope });
});

app.get('/auth/login', secure(ENDPOINT_PASSWORD), (req, res) => {
  // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
  res.redirect(
    `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${
      AppConfig.redirectUri
    }&response_type=code&scope=${AppConfig.scopes.join('+')}&force_verify=true`
  );
});

app.post('/auth/token', secure(ENDPOINT_PASSWORD), (req, res) => {
  try {
    const accessToken = req.body.token;
    if (accessToken && AuthManager.isValidAccessToken(accessToken)) {
      AuthManager.getInstance().setAccessToken(accessToken);
      return res.status(200).json({ message: 'Access-Token updated' });
    } else return res.status(403).json({ message: 'Invalid Access-Token provided' });
  } catch (error) {
    return res.status(500).json({ error });
  }
});

app.get('/app', (req, res) => {
  const status = AuthManager.getInstance().getBotStatus();
  return res
    .status(Object.entries(status).some(([_, statusObj]) => statusObj.status !== 'RUNNING') ? 500 : 200)
    .json({ status });
});

app.get('/app/start', secure(ENDPOINT_PASSWORD), async (req, res) => {
  emit('bot:start');
  emit('listener:start');
  await sleep(1000);
  res.redirect('/app');
});

app.get('/app/bot/status', (req, res) => {
  const status = AuthManager.getInstance().getBotStatus().bot;
  return res.status(status.status !== 'RUNNING' ? 500 : 200).json({ status });
});

app.get('/app/bot/start', secure(ENDPOINT_PASSWORD), async (req, res) => {
  emit('bot:start');
  await sleep(1000);
  res.redirect('/app/bot/status');
});

app.get('/app/listener/status', (req, res) => {
  const status = AuthManager.getInstance().getBotStatus().eventListener;
  return res.status(status.status !== 'RUNNING' ? 500 : 200).json({ status });
});

app.get('/app/listener/start', secure(ENDPOINT_PASSWORD), async (req, res) => {
  emit('listener:start');
  await sleep(1000);
  res.redirect('/app/listener/status');
});

app.get('/app/listener/stop', secure(ENDPOINT_PASSWORD), async (req, res) => {
  emit('listener:stop');
  await sleep(1000);
  res.redirect('/app/listener/status');
});

server.listen(AppConfig.port, async () => {
  log('LOG', LogCategory.Setup, 'Server listening on localhost:' + AppConfig.port);

  if (AppConfig.chatBot.autoStart) {
    emit('bot:start');
  }

  if (AppConfig.listener.autoStart) {
    emit('listener:start');
  }
});

export function sleep(timeInMillis = 1000) {
  return new Promise((res) => setTimeout(res, timeInMillis));
}
