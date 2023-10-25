import axios from 'axios';
import { ApiClient as TwurpleApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { AppEventEmitter, AuthManager } from '.';
import { LogCategory, log } from '../middleware';
import { TWITCH_CHANNEL, TWITCH_CHANNEL_ID, io } from '..';
import { AppConfig } from '../app.config';

export class EventListener {
  private static instance: EventSubWsListener;

  /**
   *
   * @returns {EventSubWsListener}
   * @throws {Error}
   */
  public static async getInstance(): Promise<EventSubWsListener | undefined> {
    if (!this.instance) {
      const AuthProvider = AuthManager.getAuthProviderInstance();
      if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
        AuthManager.getInstance().addAuthProviderUser();
      }

      const ApiClient = new TwurpleApiClient({ authProvider: AuthProvider });
      await ApiClient.eventSub.deleteAllSubscriptions();

      const EventListener = new EventSubWsListener({ apiClient: ApiClient });

      try {
        EventListener.onChannelFollow(TWITCH_CHANNEL_ID, TWITCH_CHANNEL_ID, (event) => {
          log('INFO', LogCategory.EventListener, `${event.userName} now follows ${TWITCH_CHANNEL}!`);
          io.emit('twitchEvent', 'follower', event.userName);
        });

        EventListener.onStreamOnline(TWITCH_CHANNEL_ID, async (event) => {
          log('INFO', LogCategory.EventListener, event.broadcasterName + ' is now live!');
          const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
          if (!DISCORD_WEBHOOK_URL) {
            log(
              'WARN',
              LogCategory.EventListener,
              event.broadcasterName +
                " is now live, but no notifcation can be send because of the missing environment-variable 'DISCORD_WEBHOOK_URL'!"
            );
            return;
          }

          try {
            const stream = await event.getStream();
            if (!stream) return;
            const post = await axios.post(
              DISCORD_WEBHOOK_URL,
              {
                content: `Hey <@&${AppConfig.listener.role}>, wir streamen jetzt auch auf Twitch! Schaut gerne vorbei...`,
                embeds: [
                  {
                    title: stream.title,
                    url: 'https://twitch.com/PanthorDE',
                    color: 16711680,
                    image: {
                      url: stream.getThumbnailUrl(800, 450),
                    },
                  },
                ],
                username: 'Twitch - Panthor',
                avatar_url:
                  'https://static-cdn.jtvnw.net/jtv_user_pictures/87a3eef3-f4f4-4e7f-a8f4-934103145c9c-profile_image-70x70.png',
              },
              {
                headers: { 'Content-Type': 'application/json' },
              }
            );
            log('INFO', LogCategory.EventListener, 'Send notification and received status ' + post.status);
          } catch (error) {
            log('ERROR', LogCategory.DiscordNotification, (error as Error).message);
          }
        });

        EventListener.onStreamOffline(TWITCH_CHANNEL_ID, (event) => {
          log('INFO', LogCategory.EventListener, event.broadcasterName + ' is now offline!');
        });

        // @ts-ignore
        EventListener.onUserSocketConnect((e) => {
          AuthManager.getInstance().updateBotStatus('eventListener', {
            status: 'RUNNING',
            reason: 'Connected successfully',
          });
          log('INFO', LogCategory.EventListener, `EventListener connected! More ${JSON.stringify(e)}`);
        });

        // @ts-ignore
        EventListener.onUserSocketDisconnect((userId, error) => {
          try {
            const errorMsg = error instanceof Error ? error.message : error;
            AuthManager.getInstance().updateBotStatus('eventListener', { status: 'STOPPED', reason: errorMsg });
            log('INFO', LogCategory.EventListener, `EventListener disconnected! More ${errorMsg}`);
            if (AppConfig.listener.autoRestart) {
              AppEventEmitter.emit('listener:start');
            }

            // EventListener.stop();
            // log('WARN', LogCategory.EventListener, `EventListener stopped!`);
          } catch (error) {
            log('ERROR', LogCategory.EventListener, `Something went wrong! More ${(error as Error).message}`);
          }
        });
      } catch (error) {
        log('ERROR', LogCategory.EventListener, `Something went wrong during initialisation. More ${error}`);
      }

      this.instance = EventListener;
    }

    return this.instance;
  }

  /**
   * @throws {Error}
   */
  public async start() {
    if (AuthManager.getInstance().getBotStatus().eventListener.status === 'RUNNING') {
      const msg = "EventListener is already listening and can't get initialized twice";
      log('WARN', LogCategory.EventListener, msg);
      throw new Error(msg);
    }

    (await EventListener.getInstance())?.start();
  }

  /**
   * @throws {Error}
   */
  public async stop() {
    if (AuthManager.getInstance().getBotStatus().eventListener.status !== 'RUNNING') {
      const msg = "The EventListener isn't running and therefore can't get stopped";
      log('WARN', LogCategory.EventListener, msg);
      throw new Error(msg);
    }

    (await EventListener.getInstance())?.stop();
  }
}
