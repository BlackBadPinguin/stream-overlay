import { differenceInHours } from 'date-fns';
import { Bot, createBotCommand } from '@twurple/easy-bot';
import { getExpiryDateOfAccessToken } from '@twurple/auth';
import { AppConfig } from '../app.config';
import { LogCategory, log } from '../middleware';
import { AuthManager } from './AuthManager';
import { TWITCH_CHANNEL_ID, io } from '..';

export async function initChatBot(channel: string) {
  console.log('A');
  if (AuthManager.getInstance().getBotStatus().bot.status === 'RUNNING') {
    log('WARN', LogCategory.ChatBot, "Chatbot is already running and can't get initialized twice");
    return;
  }

  console.log('B');
  const accessToken = AuthManager.getInstance().getAccessToken();
  const isAccessTokenProvided = accessToken != null;
  if (!isAccessTokenProvided) {
    log('ERROR', LogCategory.AccessToken, 'No access-token provided');
    return;
  }

  console.log('C');
  if (isAccessTokenProvided && typeof accessToken != 'string') {
    const accessTokenExpirationTime = getExpiryDateOfAccessToken(accessToken!);
    const dateInHours = accessTokenExpirationTime ? differenceInHours(new Date(), accessTokenExpirationTime) : 0;
    if (dateInHours < 12) log('WARN', LogCategory.AccessToken, 'Access-Token expires in ' + accessTokenExpirationTime);
  }

  console.log('D');
  const AuthProvider = AuthManager.getAuthProviderInstance();
  if (!AuthProvider.hasUser(TWITCH_CHANNEL_ID)) {
    await AuthManager.getInstance().addAuthProviderUser();
  }

  const bot = new Bot({
    debug: AppConfig.environment == 'DEV',
    authProvider: AuthProvider,
    channel: channel,
    prefix: AppConfig.chatBot.prefix,
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
      createBotCommand('timer', (params, { msg, reply, say }) => {
        const userInfo = msg.userInfo;
        if (!userInfo.isMod && !userInfo.isBroadcaster) {
          return reply(AppConfig.chatBot.messages.noPermission);
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
    ],
  });

  bot.onConnect(() => log('INFO', LogCategory.ChatBot, 'Chatbot connected to chat'));

  bot.onDisconnect((manually, reason) => {
    log(
      'INFO',
      LogCategory.ChatBot,
      `Chatbot ${manually && 'manually'} disconnected from chat. Reason '${reason ? reason.message : 'UNKNOWN'}'`
    );
  });

  bot.onAuthenticationSuccess(() => {
    log('INFO', LogCategory.ChatBot, 'Chatbot authentificated successfully');
    AuthManager.getInstance().updateBotStatus('bot', { status: 'RUNNING', reason: 'Connected successfully' });
  });

  bot.onAuthenticationFailure((text, retryCount) => {
    log('ERROR', LogCategory.ChatBot, `Attempt ${retryCount} of chatbot-authentification failed because of '${text}'`);
    AuthManager.getInstance().updateBotStatus('bot', { status: 'STOPPED_INVALID_ACCESS_TOKEN', reason: text });
  });

  bot.onMessage((event) => {
    const msg = event.text;
    if (msg.substring(0, 1) === AppConfig.chatBot.prefix) return;

    log('INFO', LogCategory.ChatMessage, event.userName + '::' + msg);
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
}
