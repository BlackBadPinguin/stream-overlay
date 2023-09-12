import { AppConfig } from '../app.config';
import { log } from '../middleware';
import { AuthManager } from './AuthManager';
import { Bot, createBotCommand } from '@twurple/easy-bot';
import { io } from '..';

const NotAllowedMsg = 'Das darfst du nicht!';

export async function initChatBot(channels: string[]) {
  // TODO: Prüfe ob es eine AuthProvider Instance gibt
  // TODO: Prüfe ob es einen gültigen Access-Token gibt

  const AuthProvider = AuthManager.getAuthProviderInstance();
  //   const apiClient = new ApiClient({ authProvider: AuthProvider });
  const bot = new Bot({
    debug: AppConfig.environment == 'DEV',
    authProvider: AuthProvider,
    channels: channels,
    prefix: AppConfig.prefix,
    commands: [
      createBotCommand('dice', (params, { reply }) => {
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        reply(`You rolled a ${diceRoll}`);
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
          return reply(NotAllowedMsg);
        }

        reply(`Hinweis ${params.length > 0 ? 'geändert' : 'gelöscht'}!`);
        io.emit(
          'update',
          'hint',
          params.length > 0 ? ['custom', '', params.join(' '), 'fa-solid fa-fa-fire'] : ['none', '', '', '']
        );
      }),
      createBotCommand('topic', (params, { msg, reply, say }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(NotAllowedMsg);
        }

        if (params.length === 0) {
          return reply('Ungültiger Syntax. Versuche...');
        }

        const topic = params.join(' ');
        say('Thema geändert zu ' + topic);
        io.emit('update', 'topic', topic);
      }),
      createBotCommand('timer', (params, { msg, reply, say }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(NotAllowedMsg);
        }

        if (params.length === 0) {
          say('Timer zurückgesetzt!');
          io.emit('update', 'timer', AppConfig.overlay.timerLength);
        } else if (params.length === 1) {
          say('Timer zurückgesetzt und länge angepasst!');
          io.emit('update', 'timer', Number(Number(params[0]).toFixed(0)));
        } else return reply('Ungültiger Syntax. Versuche...');
      }),
      createBotCommand('scene', (params, { msg, reply, say }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(NotAllowedMsg);
        }

        if (params.length === 0 || !AppConfig.overlay.scenes.some((scene) => scene === params[0].toLowerCase())) {
          return reply(`Ungültiger Syntax. Versuche scene [${AppConfig.overlay.scenes.join('|')}]`);
        }

        const scene = params[0].toLowerCase();
        reply(`Szene zu '${scene}' gewechselt!`);
        io.emit('scene', scene, false);
      }),
    ],
  });

  bot.onConnect(() => log('INFO', 'bot-connection', 'Chatbot connected to chat'));

  bot.onDisconnect((manually, reason) => {
    log(
      'INFO',
      'bot-connection',
      `Chatbot ${manually && 'manually'} disconnected from chat. Reason '${reason ? reason.message : 'UNKNOWN'}'`
    );
  });

  bot.onMessage((event) => {
    const msg = event.text;
    // const userInfo = await event.getUser();
    log('INFO', 'message', event.userName + ' :: ' + msg);

    io.emit('chatMessage', msg, [false], [event.userDisplayName, false, false, false, false, false]);
    // io.emit("chatMessage", parsedMSG.join(" "), [msg.isFirst], [userInfo.displayName, userInfo.isBroadcaster, userInfo.isMod, userInfo.isArtist, userInfo.isVip, userInfo.isSubscriber]);
  });

  bot.onSub(({ broadcasterName, userName }) => {
    bot.say(broadcasterName, `Thanks to @${userName} for subscribing to the channel!`);
  });

  bot.onResub(({ broadcasterName, userName, months }) => {
    bot.say(broadcasterName, `Thanks to @${userName} for subscribing to the channel for a total of ${months} months!`);
  });

  bot.onSubGift(({ broadcasterName, gifterName, userName }) => {
    bot.say(broadcasterName, `Thanks to @${gifterName} for gifting a subscription to @${userName}!`);
  });
}
