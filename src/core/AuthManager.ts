import dotenv from 'dotenv';
dotenv.config();
import { AppConfig } from '../app.config';
import type { DataWithError } from '../types';
import { RefreshingAuthProvider, type AccessToken, exchangeCode } from '@twurple/auth';
import { log } from '../middleware';

export class AuthManager {
  private static instance = new AuthManager();
  private static authProviderInstance: RefreshingAuthProvider;
  private code: string | null = null;
  private accessToken: AccessToken | string | null = null;
  private scopes = AppConfig.scopes;
  private redirectUri = AppConfig.redirectUri;

  public static getInstance(): AuthManager {
    return this.instance;
  }

  public setCode(code: string) {
    this.code = code;
  }

  public getCode() {
    return this.code;
  }

  public setAccessToken(accessToken: AccessToken | string) {
    this.accessToken = accessToken;
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
        log('INFO', 'RefreshingAuthProvider', 'Refresh token for ' + userId + ' was refreshed');
        AuthManager.getInstance().setAccessToken(newToken);
      });

      rap.onRefreshFailure(([userId]) => {
        log('INFO', 'RefreshingAuthProvider', "Couldn't refresh the access-token for " + userId);
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
}
