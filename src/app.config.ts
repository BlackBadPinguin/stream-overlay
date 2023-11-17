import dotenv from 'dotenv';
dotenv.config();
import path from 'path';

export type AppConfig = {
  environment: 'PROD' | 'DEV';
  environmentVariables: string[];
  redirectUri: string;
  scopes: string[];
  port: number;
  tokensLocation: string;
  overlay: {
    scenes: string[];
    startingScene: AppConfig['overlay']['scenes'][number];
    timerLength: number;
  };
  chatBot: {
    autoStart: boolean;
    prefix: string;
    messages: {
      noPermission: string;
    };
  };
  listener: {
    autoStart: boolean;
    role: string;
  };
};

export const AppConfig: AppConfig = {
  // TODO: Convert into branded type
  environment: determineRuntimeEnvironment(),
  environmentVariables: ['CLIENT_ID', 'CLIENT_SECRET', 'TWITCH_CHANNEL', 'TWITCH_CHANNEL_ID', 'ENDPOINT_PASSWORD'],
  redirectUri: determineRuntimeEnvironment() === 'PROD' ? 'https://overlay.tklein.it' : 'http://localhost',
  scopes: [
    'channel:manage:broadcast',
    'channel:manage:polls',
    'channel:manage:predictions',
    'channel:manage:redemptions',
    'channel:moderate',
    'channel:read:goals',
    'channel:read:hype_train',
    'channel:read:polls',
    'channel:read:predictions',
    'channel:read:redemptions',
    'channel:read:subscriptions',
    'channel:read:vips',
    'chat:edit',
    'chat:read',
    'moderation:read',
    'moderator:manage:announcements',
    'moderator:manage:banned_users',
    'moderator:manage:chat_messages',
    'moderator:read:chat_settings',
    'moderator:read:chatters',
    'moderator:read:followers',
    'moderator:read:shoutouts',
  ],
  port: determineRuntimeEnvironment() === 'PROD' ? 8090 : 80,
  tokensLocation: path.join(__dirname, '../', 'data'), // will create an tokens.json here
  overlay: {
    timerLength: 5000,
    scenes: ['start', 'dev', 'chat', 'pause', 'end'],
    startingScene: 'start',
  },
  chatBot: {
    autoStart: true,
    prefix: '!',
    messages: {
      noPermission: 'Das darfst du nicht!',
    },
  },
  listener: {
    autoStart: true,
    role: '1164253679956795463',
  },
};

export function determineRuntimeEnvironment(): AppConfig['environment'] {
  const env = process.env.ENV;
  if (!env) return 'DEV';
  if (env.toUpperCase() === 'PROD') return 'PROD';
  return 'DEV';
}
