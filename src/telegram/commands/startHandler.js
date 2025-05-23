// src/telegram/commands/startHandler.js
const stateService = require('../../services/stateService'); 
const logger = require('../../utils/logger'); 
const { GREETING_MESSAGE } = require('../../constants'); 
const { mainKeyboard, getUserLogInfo, saveUserCommand } = require('../telegramUtils'); 

function register(bot) {
    bot.onText(/\/start$/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        logger.log(`[Cmd][Start] /start ${getUserLogInfo(msg)}`);
        
        await saveUserCommand(chatId, userId, '/start');
        stateService.clearSessionState(userId); // Используется clearSessionState - OK

        bot.sendMessage(chatId, GREETING_MESSAGE, mainKeyboard)
          .catch(err => logger.error(`[Cmd][Start] Ошибка отправки приветствия ChatID: ${chatId}:`, err));
      });
}

module.exports = { register };