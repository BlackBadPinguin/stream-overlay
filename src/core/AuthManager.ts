import dotenv from 'dotenv';
dotenv.config();
import { AppConfig } from '../app.config';
import type { DataWithError } from '../types';
import { RefreshingAuthProvider, type AccessToken, exchangeCode } from '@twurple/auth';
import { LogCategory, log } from '../middleware';
import path from 'path';
import fs from 'fs';
import { TWITCH_CHANNELS_ID } from '..';

export type ServiceRunningStatus = 'RUNNING' | 'STOPPED' | 'STOPPED_NO_ACCESS_TOKEN' | 'STOPPED_INVALID_ACCESS_TOKEN';

export type ServiceStatus = { status: ServiceRunningStatus; reason: string | null };

export type TokensFile = Record<string, { current: AccessToken | string | null; previous: (AccessToken | string)[] }>;

export class AuthManager {
  private static instance = new AuthManager();
  private static authProviderInstance: RefreshingAuthProvider;
  private code: string | null = null;
  private accessToken: AccessToken | string | null = null;
  private scopes = AppConfig.scopes;
  private redirectUri = AppConfig.redirectUri;
  private botStatus: Record<'bot' | 'eventListener', ServiceStatus> = {
    bot: { status: 'STOPPED', reason: null },
    eventListener: { status: 'STOPPED', reason: null },
  };

  constructor() {
    const { exists } = this.tokensFileExist();
    console.log(exists);
    if (exists) {
      if (!process.env.TWITCH_CHANNELS_ID || !TWITCH_CHANNELS_ID || TWITCH_CHANNELS_ID.length === 0) return;
      const userId = TWITCH_CHANNELS_ID[0];
      const userTokensFileContent = this.getTokensFileByUserId(userId);
      if (userTokensFileContent?.current) {
        console.log('setting token');
        this.setAccessToken(userTokensFileContent.current, false);
      }
    }
  }

  public static getInstance(): AuthManager {
    return this.instance;
  }

  public setCode(code: string) {
    this.code = code;
  }

  public getCode() {
    return this.code;
  }

  public setAccessToken(accessToken: AccessToken | string, writeToFile = true) {
    try {
      const {
        exists,
        file: { path },
      } = this.tokensFileExist();
      const tokensFile = this.getTokensFile();
      const userId = TWITCH_CHANNELS_ID[0];
      if (writeToFile) {
        if (!exists) {
          const data: TokensFile = {
            [userId]: {
              current: accessToken,
              previous: [],
            },
          };
          fs.writeFileSync(path, JSON.stringify(data), { encoding: 'utf8' });
        } else {
          const currentTokensFileContent = tokensFile as TokensFile;
          const userTokensFileContent = this.getTokensFileByUserId(userId);
          let updatedTokenHistory: (AccessToken | string)[] =
            userTokensFileContent !== null ? [...userTokensFileContent.previous] : [];
          if (userTokensFileContent?.current)
            updatedTokenHistory = [userTokensFileContent.current, ...updatedTokenHistory];
          const updatedData: TokensFile = {
            ...currentTokensFileContent,
            [userId]: {
              current: accessToken,
              previous: updatedTokenHistory,
            },
          };
          fs.writeFileSync(path, JSON.stringify(updatedData), { encoding: 'utf8' });
        }
      }
    } catch (error) {
      log('ERROR', LogCategory.AccessToken, error as Error);
    }

    this.accessToken = accessToken;
    log(
      'INFO',
      LogCategory.AccessToken,
      `Updated access-token from ${
        typeof this.accessToken === 'string' ? this.accessToken : JSON.stringify(accessToken)
      } to ${typeof accessToken === 'string' ? accessToken : JSON.stringify(accessToken)}`
    );
  }

  public static isValidAccessToken(token: any): boolean {
    return token satisfies AccessToken | string;
  }

  public tokensFileExist() {
    const tokensFileName = 'tokens.json',
      tokensFilePath = AppConfig.tokensLocation,
      tokensFileExists = fs.existsSync(path.join(tokensFilePath, tokensFileName));
    console.log('tokensFileExist ', tokensFileExists);

    return {
      exists: tokensFileExists,
      file: { name: tokensFileName, path: path.join(tokensFilePath, tokensFileName) },
    };
  }

  public getTokensFile(): TokensFile | null {
    const {
      exists,
      file: { path },
    } = this.tokensFileExist();

    let data = null;
    if (!exists) return data;

    try {
      data = JSON.parse(fs.readFileSync(path, 'utf8')) as TokensFile;
    } catch (error) {
      log('ERROR', LogCategory.AccessToken, error as Error);
    } finally {
      console.log('getTokensFile', data);
      return data;
    }
  }

  public getTokensFileByUserId(userId: string) {
    try {
      const fileData = this.getTokensFile();
      if (!fileData) return null;

      const containsTokenForUserId = Object.keys(fileData).some((key) => key === userId);
      if (!containsTokenForUserId) return null;

      const userTokens = fileData[userId];
      console.log('getTokensFileByUserId', userTokens);
      return userTokens;
    } catch (error) {
      log('ERROR', LogCategory.AccessToken, error as Error);
      return null;
    }
  }

  public getAccessToken() {
    return this.accessToken;
  }

  public getScopes() {
    return this.scopes;
  }

  public static getAuthProviderInstance() {
    if (!this.authProviderInstance) {
      const rap = new RefreshingAuthProvider({
        clientId: process.env.CLIENT_ID as string,
        clientSecret: process.env.CLIENT_SECRET as string,
        appImpliedScopes: AppConfig.scopes,
        redirectUri: AppConfig.redirectUri,
      });

      rap.onRefreshFailure(([userId, newToken]) => {
        log('INFO', LogCategory.RefreshingAuthProvider, 'Refresh token for ' + userId + ' was refreshed');
        AuthManager.getInstance().setAccessToken(newToken);
      });

      rap.onRefreshFailure(([userId]) => {
        log('INFO', LogCategory.RefreshingAuthProvider, "Couldn't refresh the access-token for " + userId);
      });

      this.authProviderInstance = rap;
    }
    return this.authProviderInstance;
  }

  public static setAuthProviderInstance(instance: RefreshingAuthProvider) {
    this.authProviderInstance = instance;
  }

  async obtainAccessToken(clientId: string, clientSecret: string): Promise<DataWithError<AccessToken>> {
    // https://id.twitch.tv/oauth2/token?client_id=CLIENT_ID
    //     &client_secret=CLIENT_SECRET
    //     &code=CODE_FROM_LAST_REQUEST
    //     &grant_type=authorization_code
    //     &redirect_uri=REDIRECT_URI
    if (!this.code) {
      return [null, new Error('No code provided, Visit /login to retrieve one')];
    }

    try {
      // const query = new URLSearchParams({
      //     client_id: clientId,
      //     client_secret: clientSecret,
      //     code: this.code,
      //     grant_type: "authorization_code",
      //     redirect_uri: this.redirectUri,
      // });
      // const response = await axios.post("https://id.twitch.tv/oauth2/token", query);
      // const body = response.data
      // if (response.status !== 200) {
      //     return [null, new Error(body)];
      // }
      // const at = body as AccessToken;
      // return [at, null];

      const accessToken = await exchangeCode(clientId, clientSecret, this.code, this.redirectUri);
      if (!accessToken) {
        return [null, new Error("Couldn't exchange the authorization-code for an access-token")];
      }
      return [accessToken, null];
    } catch (error) {
      return [null, error as Error];
    }
  }

  public getBotStatus() {
    return this.botStatus;
  }

  public setBotStatus(status: ReturnType<typeof this.getBotStatus>) {
    this.botStatus = status;
  }

  public updateBotStatus(service: 'bot' | 'eventListener', status: ServiceStatus) {
    this.botStatus[service] = status;
  }
}
