import { EventEmitter } from 'node:events';
import { AuthManager, ChatBot, EventListener } from '.';
import { LogCategory, logger } from '../middleware';
import { TWITCH_CHANNEL_ID } from '..';

export type Events = 'listener:start' | 'listener:stop' | 'bot:start' | 'bot:stop';

export const AppEventEmitter = new EventEmitter();

export function emit(event: Events, ...args: any[]) {
  return AppEventEmitter.emit(event, args);
}

AppEventEmitter.on('listener:start', async () => {
  logger.info("Invoked '{event}'", { category: LogCategory.EventListener, event: 'listener:start' });
  try {
    if (AuthManager.getInstance().getBotStatus().eventListener.status == 'RUNNING') {
      return logger.warn("Didn't start listener becuase it's already up running,", {
        category: LogCategory.EventListener,
      });
    }

    const { exists } = AuthManager.getInstance().tokensFileExist();
    if (!exists) {
      const msg = "Didn't start listener because no access-token were provided";
      AuthManager.getInstance().updateBotStatus('eventListener', { status: 'STOPPED_NO_ACCESS_TOKEN', reason: msg });
      return logger.warn(msg, { category: LogCategory.EventListener });
    }

    const AuthProvider = AuthManager.getAuthProviderInstance();
    if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
      await AuthManager.getInstance().addAuthProviderUser();
    }

    (await EventListener.getInstance())?.start();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : JSON.stringify(error), {
      category: LogCategory.EventListener,
    });
  }
});

AppEventEmitter.on('listener:stop', async () => {
  logger.info("Invoked '{event}'", { category: LogCategory.EventListener, event: 'listener:stop' });
  try {
    (await EventListener.getInstance())?.stop();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : JSON.stringify(error), {
      category: LogCategory.EventListener,
    });
  }
});

AppEventEmitter.on('bot:start', async () => {
  logger.info("Invoked '{event}'", { category: LogCategory.ChatBot, event: 'bot:start' });
  try {
    if (AuthManager.getInstance().getBotStatus().bot.status == 'RUNNING') {
      return;
    }

    const { exists } = AuthManager.getInstance().tokensFileExist();
    if (!exists) {
      const msg = "Didn't start chatbot because no access-token were provided";
      AuthManager.getInstance().updateBotStatus('bot', { status: 'STOPPED_NO_ACCESS_TOKEN', reason: msg });
      return logger.warn(msg, { category: LogCategory.ChatBot });
    }

    const AuthProvider = AuthManager.getAuthProviderInstance();
    if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
      await AuthManager.getInstance()
        .addAuthProviderUser()
        .then(() => ChatBot.init());
    } else ChatBot.init();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : JSON.stringify(error), {
      category: LogCategory.EventListener,
    });
  }
});
