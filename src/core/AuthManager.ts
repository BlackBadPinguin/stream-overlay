import dotenv from 'dotenv';
dotenv.config();
import { AppConfig } from '../app.config';
import type { DataWithError } from '../types';
import { RefreshingAuthProvider, type AccessToken, exchangeCode, getExpiryDateOfAccessToken } from '@twurple/auth';
import { LogCategory, logger } from '../middleware';
import path from 'path';
import fs from 'fs';
import { format, isFuture } from 'date-fns';

export type ServiceRunningStatus = 'RUNNING' | 'STOPPED' | 'STOPPED_NO_ACCESS_TOKEN' | 'STOPPED_INVALID_ACCESS_TOKEN';

export type ServiceStatus = { status: ServiceRunningStatus; reason: string | null };

export type TokensFile = { current: AccessToken | string | null; previous: (AccessToken | string)[] };

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
    if (!exists) return;
    const currentFilesContent = this.getTokensFile();
    if (currentFilesContent && currentFilesContent.current) {
      logger.info('Retrieving access-token from local tokens.json', { category: LogCategory.AccessToken });
      this.setAccessToken(currentFilesContent.current, false);
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
  public getBotStatus() {
    return this.botStatus;
  }

  public setBotStatus(status: ReturnType<typeof this.getBotStatus>) {
    this.botStatus = status;
  }

  public updateBotStatus(service: 'bot' | 'eventListener', status: ServiceStatus) {
    this.botStatus[service] = status;
  }

  public setAccessToken(accessToken: AccessToken | string, writeToFile = true) {
    if (typeof accessToken !== 'string') {
      const endDate = getExpiryDateOfAccessToken(accessToken);
      if (!endDate) {
        return logger.warn("{accessToken} doesn't have expiry information", {
          category: LogCategory.AccessToken,
          accessToken: accessToken.accessToken,
        });
      }

      if (!isFuture(endDate)) {
        return logger.warn("{accessToken.accessToken} is already expired and the token won't be saved", {
          category: LogCategory.AccessToken,
          accessToken: accessToken.accessToken,
        });
      }
    }

    if (writeToFile) {
      try {
        const {
          exists: fileExists,
          file: { path: filePath },
        } = this.tokensFileExist();
        const currentFilesContent = this.getTokensFile();
        let fileContent: TokensFile = {
          current: accessToken,
          previous: [],
        };

        if (fileExists && currentFilesContent) {
          let updatedHistory: TokensFile['previous'] = [...currentFilesContent.previous];
          if (currentFilesContent.current) updatedHistory = [currentFilesContent.current, ...updatedHistory];
          fileContent.previous = updatedHistory;
        }

        fs.writeFileSync(filePath, JSON.stringify(fileContent), { encoding: 'utf8' });
      } catch (error) {
        logger.error((error as Error).message, { category: LogCategory.AccessToken });
      }
    }

    if (typeof accessToken !== 'string') {
      const expireDate = getExpiryDateOfAccessToken(accessToken);
      if (!expireDate) return;
      logger.info('New access-token is valid until {expiration}', {
        category: LogCategory.AccessToken,
        expiration: format(expireDate, 'dd.MM.yy HH:mm:ss'),
      });
    }

    let currentToken = typeof this.accessToken === 'string' ? this.accessToken : this.accessToken?.accessToken,
      newToken = typeof accessToken === 'string' ? accessToken : accessToken.accessToken;
    logger.info('Updated access-token from {currentToken} to {newToken}', {
      category: LogCategory.AccessToken,
      currentToken: currentToken,
      newToken: newToken,
    });
    this.accessToken = accessToken;
  }

  public static isValidAccessToken(token: any): boolean {
    return token satisfies AccessToken | string;
  }

  public tokensFileExist() {
    const tokensFileName = 'tokens.json',
      tokensFilePath = AppConfig.tokensLocation,
      tokensFileExists = fs.existsSync(path.join(tokensFilePath, tokensFileName));

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
      logger.error((error as Error).message, { category: LogCategory.AccessToken });
    } finally {
      return data;
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

      rap.onRefresh(([userId, newToken]) => {
        logger.info("Refresh token for ' + userId + ' was refreshed", {
          category: LogCategory.AccessToken,
          userId: userId,
        });
        AuthManager.getInstance().setAccessToken(newToken);
      });

      rap.onRefreshFailure(([userId]) => {
        logger.error("Couldn'nt refresh the access-token for {userId}", {
          category: LogCategory.AccessToken,
          userId: userId,
        });
      });

      this.authProviderInstance = rap;
    }
    return this.authProviderInstance;
  }

  public async addAuthProviderUser() {
    const accessToken = this.getAccessToken();
    if (!accessToken || typeof accessToken === 'string') {
      throw new Error("Couldn't add a user, because no access-token we're found");
    }
    try {
      await AuthManager.getAuthProviderInstance().addUserForToken(accessToken, [...AppConfig.scopes, 'chat']);
      logger.info('Added user to access-token', { category: LogCategory.AccessToken });
    } catch (error) {
      logger.error((error as Error).message, { category: LogCategory.AccessToken });
    }
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
      logger.error((error as Error).message, { category: LogCategory.AccessToken });
      return [null, error as Error];
    }
  }
}
