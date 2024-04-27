import { Bot, type BotCommand, createBotCommand } from '@twurple/easy-bot';
import { AppConfig } from '../app.config';
import { LogCategory, logger } from '../middleware';
import { AuthManager } from './AuthManager';
import { TWITCH_CHANNEL, io } from '../index';

export class ChatBot {
  private static instance: Bot;
  private static chatbotLogger = logger.child({ class: ChatBot.name, category: LogCategory.ChatBot });

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

      bot.onConnect(() => this.chatbotLogger.info('Chatbot connected to chat'));

      bot.onDisconnect((manually, reason) => {
        this.chatbotLogger.info(
          `Chatbot ${manually ? 'manually' : 'automatically'} disconnected from chat. Reason '${
            reason ? reason.message : 'UNKNOWN'
          }'`
        );
      });

      bot.onAuthenticationSuccess(() => {
        this.chatbotLogger.info('Chatbot authentificated successfully');
        AuthManager.getInstance().updateBotStatus('bot', { status: 'RUNNING', reason: 'Connected successfully' });
      });

      bot.onAuthenticationFailure((text, retryCount) => {
        this.chatbotLogger.error(`Attempt ${retryCount} of chatbot-authentification failed because of '${text}'`);
        AuthManager.getInstance().updateBotStatus('bot', { status: 'STOPPED_INVALID_ACCESS_TOKEN', reason: text });
      });

      bot.onMessage((event) => {
        const msg = event.text;
        if (msg.substring(0, 1) === AppConfig.chatBot.prefix) return;

        this.chatbotLogger.info(`${event.userName}::${msg}`, { category: LogCategory.ChatMessage });
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
      this.chatbotLogger.error("Couldn't initialise the chat-bot", error);
    }
  }
}
