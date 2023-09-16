import axios from 'axios';
import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { AuthManager } from '.';
import { LogCategory, log } from '../middleware';
import { TWITCH_CHANNEL_ID, io } from '..';

export async function initEventListener() {
  if (AuthManager.getInstance().getBotStatus().bot.status === 'RUNNING') {
    log('WARN', LogCategory.WsListener, "EventSubWsListener is already listening and can't get initialized twice");
    return;
  }

  let accessToken = AuthManager.getInstance().getAccessToken();
  const isAccessTokenProvided = accessToken != null;
  if (!isAccessTokenProvided) {
    log('ERROR', LogCategory.AccessToken, 'No access-token provided');
    return;
  }

  const AuthProvider = AuthManager.getAuthProviderInstance();
  const apiClient = new ApiClient({ authProvider: AuthProvider });
  const listener = new EventSubWsListener({ apiClient });
  listener.start();

  listener.onUserSocketConnect(() => {
    AuthManager.getInstance().updateBotStatus('eventListener', { status: 'RUNNING', reason: 'Connected successfully' });
    log('INFO', LogCategory.WsListener, 'EventSubWsListener connected');
  });

  listener.onUserSocketDisconnect(() => {
    AuthManager.getInstance().updateBotStatus('eventListener', { status: 'STOPPED', reason: 'Disconnected' });
    log('INFO', LogCategory.WsListener, 'EventSubWsListener disconnected');
  });

  listener.onChannelFollow(TWITCH_CHANNEL_ID, TWITCH_CHANNEL_ID, (event) => {
    io.emit('twitchEvent', 'follower', event.userName);
  });

  listener.onStreamOnline(TWITCH_CHANNEL_ID, async (event) => {
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK;
    if (!DISCORD_WEBHOOK_URL) return;

    try {
      const stream = await event.getStream();
      if (!stream) return;
      const post = await axios.post(
        DISCORD_WEBHOOK_URL,
        {
          content: `Hey, wir streamen jetzt auch auf Twitch! Schaut gerne vorbei...`,
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
    } catch (error) {
      log('ERROR', LogCategory.DiscordNotification, (error as Error).message);
    }
  });
}
