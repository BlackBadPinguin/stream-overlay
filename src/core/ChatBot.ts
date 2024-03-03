import { Bot, type BotCommand, createBotCommand } from '@twurple/easy-bot';
import { AppConfig } from '../app.config';
import { LogCategory, logger } from '../middleware';
import { AuthManager } from './AuthManager';
import { TWITCH_CHANNEL, io } from '..';

export class ChatBot {
  private static instance: Bot;

  /**
   * @returns {Bot}
   * @throws {Error}
   */
  public static getInstance() {
    if (!this.instance) {
      const AuthProvider = AuthManager.getAuthProviderInstance();
      const ChatBot = new Bot({
        debug: AppConfig.environment == 'DEV',
        authProvider: AuthProvider,
        channel: TWITCH_CHANNEL,
        prefix: AppConfig.chatBot.prefix,
        commands: this.getCommands(),
      });

      this.instance = ChatBot;
    }

    return this.instance;
  }

  public static getCommands(): BotCommand[] {
    return [
      createBotCommand('alert', () => {
        io.emit('twitchEvent', 'follower', 'demo');
      }),
      createBotCommand('ping', (params, { reply }) => {
        reply(`pong`);
      }),
      createBotCommand('server', (params, { userName, reply }) => {
        reply(`Der Server heißt Panthor Life. Alle Informationen findest du unter https://panthor.de`);
      }),
      createBotCommand('mitspielen', (params, { userName, reply }) => {
        reply(`Der Server heißt Panthor Life. Alle Informationen findest du unter https://panthor.de`);
      }),
      createBotCommand('hint', (params, { msg, say, reply }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(AppConfig.chatBot.messages.noPermission);
        }

        reply(`Hinweis ${params.length > 0 ? 'geändert' : 'gelöscht'}!`);
        io.emit(
          'update',
          'hint',
          params.length > 0 ? ['custom', '', params.join(' '), 'fa-solid fa-fire'] : ['none', '', '', '']
        );
      }),
      createBotCommand('topic', (params, { msg, reply, say }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(AppConfig.chatBot.messages.noPermission);
        }

        if (params.length === 0) {
          return reply('Ungültiger Syntax. Versuche...');
        }

        const topic = params.join(' ');
        say('Thema geändert zu ' + topic);
        io.emit('update', 'topic', topic);
      }),
      createBotCommand('time', (params, { msg, reply, say }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(AppConfig.chatBot.messages.noPermission);
        }

        if (params.length === 0) {
          say('Countdown zurückgesetzt!');
          io.emit('update', 'time', AppConfig.overlay.timerLength);
        } else if (params.length === 1) {
          say('Countdown angepasst!');
          io.emit('update', 'time', Number(Number(params[0]).toFixed(0)));
        } else return reply(`Ungültiger Syntax. Versuche ${AppConfig.chatBot.prefix}timer <Minuten>`);
      }),
      createBotCommand('scene', (params, { msg, reply, say }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(AppConfig.chatBot.messages.noPermission);
        }

        if (params.length === 0 || !AppConfig.overlay.scenes.some((scene) => scene === params[0].toLowerCase())) {
          return reply(
            `Ungültiger Syntax. Versuche ${AppConfig.chatBot.prefix}scene [${AppConfig.overlay.scenes.join('|')}]`
          );
        }

        const scene = params[0].toLowerCase();
        reply(`Szene zu '${scene}' gewechselt!`);
        io.emit('scene', scene, false);
      }),
    ];
  }

  /**
   * Will apply all wanted event-listeners and their handlers
   */
  public static init() {
    try {
      const bot = ChatBot.getInstance();

      bot.onConnect(() => logger.info('Chatbot connected to chat', { category: LogCategory.ChatBot }));

      bot.onDisconnect((manually, reason) => {
        logger.info("Chatbot {manually} disconnected from chat. Reason '{reason}'", {
          category: LogCategory.ChatBot,
          manually: manually ? 'manually' : 'automatically',
          reason: reason ? reason.message : 'UNKNOWN',
        });
      });

      bot.onAuthenticationSuccess(() => {
        logger.info('Chatbot authentificated successfully', { category: LogCategory.ChatBot });
        AuthManager.getInstance().updateBotStatus('bot', { status: 'RUNNING', reason: 'Connected successfully' });
      });

      bot.onAuthenticationFailure((text, retryCount) => {
        logger.error("Attempt {retryCount} of chatbot-authentification failed because of '{text}'", {
          category: LogCategory.ChatBot,
          retryCount: retryCount,
          text: text,
        });
        AuthManager.getInstance().updateBotStatus('bot', { status: 'STOPPED_INVALID_ACCESS_TOKEN', reason: text });
      });

      bot.onMessage((event) => {
        const msg = event.text;
        if (msg.substring(0, 1) === AppConfig.chatBot.prefix) return;

        logger.info('{user}::{msg}', { category: LogCategory.ChatMessage, user: event.userName, message: msg });
        io.emit('chatMessage', msg, [false], [event.userDisplayName, false, false, false, false, false]);
      });

      bot.onSub(({ broadcasterName, userName }) => {
        bot.say(broadcasterName, `Danke @${userName} für das abonieren!`);
        io.emit('twitchEvent', 'sub', userName);
      });

      bot.onResub(({ broadcasterName, userName, months }) => {
        bot.say(broadcasterName, `Danke @${userName} für das erneute abonieren im ${months} Monat!`);
        io.emit('twitchEvent', 're-sub', userName);
      });

      bot.onSubGift(({ broadcasterName, gifterName, userName }) => {
        bot.say(broadcasterName, `Danke @${gifterName} für das verschenken eines Abos an @${userName}!`);
        io.emit('twitchEvent', 'gift-sub', userName);
      });
    } catch (error) {
      logger.error("Couldn't initialise the chat-bot!", { category: LogCategory.ChatBot });
    }
  }
}
