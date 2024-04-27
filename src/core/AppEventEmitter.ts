import { EventEmitter } from 'node:events';
import { AuthManager, ChatBot, EventListener } from './index';
import { LogCategory, logger } from '../middleware';
import { TWITCH_CHANNEL_ID } from '../index';
import { generateRandomId } from '../utils';
import winston from 'winston';

export type Events = 'listener:start' | 'listener:stop' | 'bot:start' | 'bot:stop';

/**
 * Event emitter for the application.
 */
export const AppEventEmitter = new EventEmitter();

/**
 * Emits the specified event with the given arguments.
 * @param event - The event to emit.
 * @param args - The arguments to pass to the event handlers.
 * @returns A boolean indicating whether the event was emitted successfully.
 */
export function emit(event: Events, ...args: any[]) {
  return AppEventEmitter.emit(event, args);
}

const initEventLogger: (event: Events, options?: Object) => winston.Logger = (event, options = {}) => {
  return logger.child({ event: event, eventId: generateRandomId(12), category: LogCategory.EventListener, ...options });
};

AppEventEmitter.on('listener:start', async () => {
  const eventLogger = initEventLogger('listener:start');

  eventLogger.info("Invoked 'listener:stzart'");
  try {
    if (AuthManager.getInstance().getBotStatus().eventListener.status == 'RUNNING') {
      return eventLogger.warn("Didn't start listener becuase it's already up running,");
    }

    const { exists } = AuthManager.getInstance().tokensFileExist();
    if (!exists) {
      const msg = "Didn't start listener because no access-token were provided";
      AuthManager.getInstance().updateBotStatus('eventListener', { status: 'STOPPED_NO_ACCESS_TOKEN', reason: msg });
      return eventLogger.warn(msg);
    }

    const AuthProvider = AuthManager.getAuthProviderInstance();
    if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
      await AuthManager.getInstance().addAuthProviderUser();
    }

    (await EventListener.getInstance())?.start();
  } catch (error) {
    logger.error((error as Error).message, error);
  }
});

AppEventEmitter.on('listener:stop', async () => {
  const eventLogger = initEventLogger('listener:start');

  eventLogger.info("Invoked 'listener:stop'");
  try {
    (await EventListener.getInstance())?.stop();
  } catch (error) {
    eventLogger.error((error as Error).message, error);
  }
});

AppEventEmitter.on('bot:start', async () => {
  const eventLogger = initEventLogger('bot:start', { category: LogCategory.ChatBot });

  eventLogger.info("Invoked 'bot:start'");
  try {
    if (AuthManager.getInstance().getBotStatus().bot.status == 'RUNNING') {
      return;
    }

    const { exists } = AuthManager.getInstance().tokensFileExist();
    if (!exists) {
      const msg = "Didn't start chatbot because no access-token were provided";
      AuthManager.getInstance().updateBotStatus('bot', { status: 'STOPPED_NO_ACCESS_TOKEN', reason: msg });
      return eventLogger.warn(msg);
    }

    const AuthProvider = AuthManager.getAuthProviderInstance();
    if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
      await AuthManager.getInstance()
        .addAuthProviderUser()
        .then(() => ChatBot.init());
    } else ChatBot.init();
  } catch (error) {
    logger.error((error as Error).message, error);
  }
});
