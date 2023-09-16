import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { AppConfig } from './app.config';
import { LogCategory, log, logMiddleware } from './middleware';
import path from 'path';
import { AuthManager, initChatBot, initEventListener } from './core';
import { Server } from 'socket.io';

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
  log('INFO', LogCategory.AccessToken, accessToken);

  return res.json({ code, scope });
});

app.get('/auth/login', (req, res) => {
  // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
  res.redirect(
    `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${
      AppConfig.redirectUri
    }&response_type=code&scope=${AppConfig.scopes.join('+')}&force_verify=true`
  );
});

app.post('/auth/token', (req, res) => {
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

app.get('/bot/init', async (req, res) => {
  if (!process.env.BOT_INIT_PASSWORD) {
    return res.json({ message: 'This endpoint is disabled' });
  }
  const pwd = req.query.password;
  if (!pwd) {
    return res.json({ message: "Provide an 'password' query-parameter" });
  }

  if (pwd !== process.env.BOT_INIT_PASSWORD) {
    return res.json({ message: 'Provided password is invalid' });
  }

  try {
    const status = AuthManager.getInstance().getBotStatus();
    let startedServices: string[] = [];

    if (status.bot.status !== 'RUNNING') {
      startedServices.push('Chatbot');
      await initChatBot(TWITCH_CHANNEL);
    }

    if (status.eventListener.status !== 'RUNNING') {
      startedServices.push('Event-listener');
      await initEventListener();
    }

    if (startedServices.length === 0) {
      return res.json({ message: 'All services are already running' });
    } else {
      await sleep(500);
      res.redirect('/bot/status');
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: (error as Error).message });
  }
});

app.get('/bot/status', (req, res) => {
  const botStatus = AuthManager.getInstance().getBotStatus();
  return res
    .status(Object.entries(botStatus).some(([_, statusObj]) => statusObj.status !== 'RUNNING') ? 500 : 200)
    .json(botStatus);
});

server.listen(AppConfig.port, async () => {
  log('INFO', LogCategory.Setup, 'Server listening on localhost:' + AppConfig.port);
});

const sleep = (time = 1000) => new Promise((res) => setTimeout(() => res, time));
