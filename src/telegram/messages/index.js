// src/telegram/messages/index.js
const leadCollectorHandler = require('./leadCollectorHandler');
const defaultMessageHandler = require('./defaultMessageHandler');
const { handleNewDialogueAction } = require('../commands/newDialogueHandler');
const { handleDirectLeadRequest } = require('../commands/directLeadRequestHandler'); // <--- НОВЫЙ ОБРАБОТЧИК
const logger = require('../../utils/logger');
const { MAIN_MENU_NEW_DIALOGUE, MAIN_MENU_LEAD_REQUEST } = require('../../constants');

function register(bot) {
    bot.on('message', async (msg) => {
        const text = msg.text?.trim();
        const chatId = msg.chat.id; // Нужен для handleDirectLeadRequest
        const userId = msg.from.id; // Нужен для handleDirectLeadRequest

        // 1. Обработка текстовых кнопок главного меню
        if (text === MAIN_MENU_NEW_DIALOGUE) {
            await handleNewDialogueAction(bot, msg, text); 
            return; 
        }
        if (text === MAIN_MENU_LEAD_REQUEST) {
            await handleDirectLeadRequest(bot, msg); // <--- ВЫЗОВ НОВОГО ОБРАБОТЧИКА
            return;
        }

        // 2. Игнорирование команд (они обрабатываются через onText) и пустых сообщений
        if (!text || text.startsWith('/')) {
            return; 
        }

        // 3. Попытка обработать как часть сбора лида
        const wasHandledByLeadCollector = await leadCollectorHandler.handle(bot, msg);
        if (wasHandledByLeadCollector) {
            return; 
        }

        // 4. Если не обработано выше, передаем в дефолтный обработчик для LLM
        await defaultMessageHandler.handle(bot, msg);
    });
}

module.exports = { register };