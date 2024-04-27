import axios from 'axios';
import { ApiClient as TwurpleApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { AuthManager } from './index';
import { LogCategory, logger } from '../middleware';
import { TWITCH_CHANNEL, TWITCH_CHANNEL_ID, io } from '../index';
import { AppConfig } from '../app.config';

export class EventListener {
  private static instance: EventSubWsListener;
  private static eventListenerLogger = logger.child({ class: EventListener.name, category: LogCategory.EventListener });

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
          this.eventListenerLogger.info(`${event.userName} now follows ${TWITCH_CHANNEL}!`, {
            channel: TWITCH_CHANNEL,
          });
          io.emit('twitchEvent', 'follower', event.userName);
        });

        EventListener.onStreamOnline(TWITCH_CHANNEL_ID, async (event) => {
          this.eventListenerLogger.info(`${TWITCH_CHANNEL} is now live!`, {
            channel: TWITCH_CHANNEL,
            category: LogCategory.DiscordNotification,
          });
          const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
          if (!DISCORD_WEBHOOK_URL) {
            this.eventListenerLogger.warn(
              `${TWITCH_CHANNEL} is now live, but no notifcation can be send because of the missing environment-variable 'DISCORD_WEBHOOK_URL'!`,
              {
                channel: TWITCH_CHANNEL,
                category: LogCategory.DiscordNotification,
              }
            );
            return;
          }

          try {
            const stream = await event.getStream();
            if (!stream) return;
            const post = await axios.post(
              DISCORD_WEBHOOK_URL,
              {
                content: `Hey <@&${AppConfig.listener.role}>, wir streamen jetzt auf Twitch! Schaut gerne vorbei...`,
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
            this.eventListenerLogger.info(`Sent notification and received status ${post.status}`, {
              channel: post.status,
              category: LogCategory.DiscordNotification,
            });
          } catch (error) {
            this.eventListenerLogger.error((error as Error).message, error);
          }
        });

        EventListener.onStreamOffline(TWITCH_CHANNEL_ID, (event) => {
          this.eventListenerLogger.error(`${event.broadcasterDisplayName} is now offline!`, {
            category: LogCategory.DiscordNotification,
          });
        });

        EventListener.onUserSocketConnect((userId: string) => {
          AuthManager.getInstance().updateBotStatus('eventListener', {
            status: 'RUNNING',
            reason: 'Connected successfully',
          });
          this.eventListenerLogger.info(`EventListener connected! More ${userId}`);
        });

        EventListener.onUserSocketDisconnect((userId: string, error: Error | undefined) => {
          try {
            const errorMsg = error ? error.message : 'Disconnected without error';
            AuthManager.getInstance().updateBotStatus('eventListener', { status: 'STOPPED', reason: errorMsg });
            this.eventListenerLogger.info(`EventListener disconnected! More ${userId}`);

            // EventListener.stop();
            // log('WARN', LogCategory.EventListener, `EventListener stopped!`);
          } catch (error) {
            this.eventListenerLogger.error((error as Error).message, error);
          }
        });
      } catch (error) {
        this.eventListenerLogger.error('Something went wrong during initialisation. More {error}', {
          category: LogCategory.EventListener,
          error: (error as Error).message,
        });
      }

      this.instance = EventListener;
    }

    return this.instance;
  }

  /**
   * @throws {Error}
   */
  public async start() {
    const authInstance = AuthManager.getInstance();

    if (authInstance.getBotStatus().eventListener.status === 'RUNNING') {
      const msg = "EventListener is already listening and can't get initialized twice";
      logger.warn(msg, { class: EventListener.name, category: LogCategory.EventListener });
      throw new Error(msg);
    }

    (await EventListener.getInstance())?.start();
  }

  /**
   * @throws {Error}
   */
  public async stop() {
    const authInstance = AuthManager.getInstance();

    if (authInstance.getBotStatus().eventListener.status !== 'RUNNING') {
      const msg = "The EventListener isn't running and therefore can't get stopped";
      logger.warn(msg, { class: EventListener.name, category: LogCategory.EventListener });
      throw new Error(msg);
    }

    (await EventListener.getInstance())?.stop();
  }
}
