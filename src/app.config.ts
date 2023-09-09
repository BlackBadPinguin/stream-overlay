import dotenv from 'dotenv';
dotenv.config();

export type AppConfig = {
  environmentVariables: string[];
  // redirectUri: string
  // scopes: string[];
  port: number;
};

export const AppConfig: AppConfig = {
  environmentVariables: [],
  // environmentVariables: ['CLIENT_ID', 'CLIENT_SECRET', 'TWITCH_CHANNELS', "TWITCH_CHANNELS_ID"],
  // redirectUri: "http://localhost",
  // scopes: [
  //   "chat:edit"
  // ],
  port: 8090,
};
