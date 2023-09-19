import { EventEmitter } from 'node:events';
import { AuthManager, EventListener } from '.';
import { LogCategory, log } from '../middleware';
import { TWITCH_CHANNEL_ID } from '..';

export type Events = 'listener:start' | 'listener:stop' | 'bot:start' | 'bot:stop';

export const AppEventEmitter = new EventEmitter();

export function emit(event: Events, ...args: any[]) {
  return AppEventEmitter.emit(event, args);
}

AppEventEmitter.on('listener:start', async () => {
  try {
    if (AuthManager.getInstance().getBotStatus().eventListener.status == 'RUNNING') {
      return;
    }

    const AuthProvider = AuthManager.getAuthProviderInstance();
    if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
      await AuthManager.getInstance().addAuthProviderUser();
    }
    EventListener.getInstance().start();
  } catch (error) {
    log('ERROR', LogCategory.EventListener, error instanceof Error ? error.message : JSON.stringify(error));
  }
});

AppEventEmitter.on('listener:stop', () => {
  try {
    if (AuthManager.getInstance().getBotStatus().eventListener.status == 'RUNNING') {
      return;
    }
    EventListener.getInstance().stop();
  } catch (error) {
    log('ERROR', LogCategory.EventListener, error instanceof Error ? error.message : JSON.stringify(error));
  }
});

AppEventEmitter.on('bot:start', () => {
  console.log('START BOT');
});

AppEventEmitter.on('bot:stop', () => {
  console.log('STOP BOT');
});
