import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { AppConfig } from './app.config';
import { log, logMiddleware } from './middleware';
import path from 'path';
import { AuthManager, initChatBot } from './core';
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

const CLIENT_ID = process.env.CLIENT_ID as string;
const CLIENT_SECRET = process.env.CLIENT_SECRET as string;
const TWITCH_CHANNELS = (process.env.TWITCH_CHANNELS as string).split(',');

console.table({ CLIENT_ID, CLIENT_SECRET, TWITCH_CHANNELS });

const app = express();
const server = http.createServer(app);
export const io = new Server(server);

app.use(logMiddleware);
app.use('/static', express.static(path.join(__dirname, '../public')));

app.get('/', async (req, res, next) => {
  const code = req.query.code,
    scope = req.query.scope;
  if (!code) return res.json({ message: 'code is not provided' });
  if (!scope) return res.json({ message: 'scope is not provided' });

  AuthManager.getInstance().setCode(code as string);
  log('INFO', 'code', code);

  const [accessToken, error] = await AuthManager.getInstance().obtainAccessToken(CLIENT_ID, CLIENT_SECRET);
  if (error) {
    log('ERROR', 'access-token', error);
    return res.json({ message: "Couldn't retrieve an access-token" });
  }
  if (!accessToken) return res.json({ message: 'Received an empty access-token' });
  AuthManager.getInstance().setAccessToken(accessToken);
  log('INFO', 'access-token', accessToken);

  const authProvider = AuthManager.getAuthProviderInstance();
  await authProvider.addUserForToken(accessToken, [...AppConfig.scopes, 'chat']);
  AuthManager.setAuthProviderInstance(authProvider);

  initChatBot(TWITCH_CHANNELS);

  return res.json({ code, scope });
});

app.get('/login', (req, res, next) => {
  // const query = new URLSearchParams({
  //   client_id: CLIENT_ID,
  //   redirect_uri: AppConfig.redirectUri,
  //   response_type: 'code', // code, token
  //   scope: AppConfig.scopes.join('+'),
  //   force_verify: 'true',
  // });
  // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
  // res.redirect('https://id.twitch.tv/oauth2/authorize?' + query.toString());

  res.redirect(
    `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${
      AppConfig.redirectUri
    }&response_type=code&scope=${AppConfig.scopes.join('+')}&force_verify=true`
  );
});

server.listen(AppConfig.port, async () => {
  log('INFO', 'starting', 'Server listening on localhost:' + AppConfig.port);
});
