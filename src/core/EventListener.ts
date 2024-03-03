import axios from 'axios';
import { ApiClient as TwurpleApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { AuthManager } from '.';
import { LogCategory, logger } from '../middleware';
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
          logger.info('{user} now follows {channel}!', {
            user: event.userName,
            channel: TWITCH_CHANNEL,
            category: LogCategory.EventListener,
          });
          io.emit('twitchEvent', 'follower', event.userName);
        });

        EventListener.onStreamOnline(TWITCH_CHANNEL_ID, async (event) => {
          logger.info('{channel} is now live!', {
            channel: TWITCH_CHANNEL,
            category: LogCategory.DiscordNotification,
          });
          const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
          if (!DISCORD_WEBHOOK_URL) {
            logger.warn(
              "{channel} is now live, but no notifcation can be send because of the missing environment-variable 'DISCORD_WEBHOOK_URL'!",
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
            logger.info('Sent notification and received status {status}', {
              channel: post.status,
              category: LogCategory.DiscordNotification,
            });
          } catch (error) {
            logger.error(JSON.stringify(error), {
              category: LogCategory.DiscordNotification,
            });
          }
        });

        EventListener.onStreamOffline(TWITCH_CHANNEL_ID, (event) => {
          logger.error('{channel} is now offline!', {
            category: LogCategory.DiscordNotification,
            channel: event.broadcasterDisplayName,
          });
        });

        EventListener.onUserSocketConnect((userId: string) => {
          AuthManager.getInstance().updateBotStatus('eventListener', {
            status: 'RUNNING',
            reason: 'Connected successfully',
          });
          logger.info('EventListener connected! More {userId}', {
            category: LogCategory.EventListener,
            userId: userId,
          });
        });

        EventListener.onUserSocketDisconnect((userId: string, error: Error) => {
          try {
            const errorMsg = error.message;
            AuthManager.getInstance().updateBotStatus('eventListener', { status: 'STOPPED', reason: errorMsg });
            logger.info('EventListener disconnected! More {userId}', {
              category: LogCategory.EventListener,
              userId: userId,
            });

            // EventListener.stop();
            // log('WARN', LogCategory.EventListener, `EventListener stopped!`);
          } catch (error) {
            logger.error('Something went wrong! More {error}', {
              category: LogCategory.EventListener,
              error: (error as Error).message,
            });
          }
        });
      } catch (error) {
        logger.error('Something went wrong during initialisation. More {error}', {
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
    if (AuthManager.getInstance().getBotStatus().eventListener.status === 'RUNNING') {
      const msg = "EventListener is already listening and can't get initialized twice";
      logger.warn(msg, { category: LogCategory.EventListener });
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
      logger.warn(msg, { category: LogCategory.EventListener });
      throw new Error(msg);
    }

    (await EventListener.getInstance())?.stop();
  }
}
