import { EventEmitter } from 'node:events';
import { AuthManager, ChatBot, EventListener } from '.';
import { LogCategory, log } from '../middleware';
import { TWITCH_CHANNEL_ID } from '..';

export type Events = 'listener:start' | 'listener:stop' | 'bot:start' | 'bot:stop';

export const AppEventEmitter = new EventEmitter();

export function emit(event: Events, ...args: any[]) {
  return AppEventEmitter.emit(event, args);
}

AppEventEmitter.on('listener:start', async () => {
  log('LOG', LogCategory.EventListener, "Invoked 'listener:start'");
  try {
    if (AuthManager.getInstance().getBotStatus().eventListener.status == 'RUNNING') {
      return log('INFO', LogCategory.EventListener, "Didn't start listener becuase it's already up running");
    }

    const { exists } = AuthManager.getInstance().tokensFileExist();
    if (!exists) {
      const msg = "Didn't start listener because no access-token were provided";
      AuthManager.getInstance().updateBotStatus('eventListener', { status: 'STOPPED_NO_ACCESS_TOKEN', reason: msg });
      return log('WARN', LogCategory.EventListener, msg);
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
  log('LOG', LogCategory.EventListener, "Invoked 'listener:stop'");
  try {
    EventListener.getInstance().stop();
  } catch (error) {
    log('ERROR', LogCategory.EventListener, error instanceof Error ? error.message : JSON.stringify(error));
  }
});

AppEventEmitter.on('bot:start', async () => {
  log('LOG', LogCategory.ChatBot, "Invoked 'bot:start'");
  try {
    if (AuthManager.getInstance().getBotStatus().bot.status == 'RUNNING') {
      return;
    }

    const { exists } = AuthManager.getInstance().tokensFileExist();
    if (!exists) {
      const msg = "Didn't start chatbot because no access-token were provided";
      AuthManager.getInstance().updateBotStatus('bot', { status: 'STOPPED_NO_ACCESS_TOKEN', reason: msg });
      return log('WARN', LogCategory.ChatBot, msg);
    }

    const AuthProvider = AuthManager.getAuthProviderInstance();
    if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
      await AuthManager.getInstance().addAuthProviderUser();
    }

    // Will call ChatBot.getInstance() before appending the listeners
    ChatBot.init();
  } catch (error) {
    log('ERROR', LogCategory.EventListener, error instanceof Error ? error.message : JSON.stringify(error));
  }
});
