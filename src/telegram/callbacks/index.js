// src/telegram/callbacks/index.js
const feedbackCallbackHandler = require('./feedbackHandler');
const leadCallbackHandler = require('./leadHandler');
const logger = require('../../utils/logger'); // Добавим логгер

function register(bot) {
    // Мы не можем просто регистрировать несколько bot.on('callback_query')
    // Событие будет поймано первым совпавшим.
    // Вместо этого, у нас должен быть ОДИН bot.on('callback_query')
    // который затем маршрутизирует на основе data.
    // Но для простоты разделения файлов, мы можем сделать так, что каждый 
    // файл-обработчик проверяет, для него ли этот callback_query.

    logger.info('[TelegramRouter][Callbacks] Регистрация обработчика feedback...');
    feedbackCallbackHandler.register(bot);
    
    logger.info('[TelegramRouter][Callbacks] Регистрация обработчика lead...');
    leadCallbackHandler.register(bot);

    // Если нужно, можно добавить общий обработчик здесь, который будет вызываться, если ни один из специфичных не сработал
    // bot.on('callback_query', async (callbackQuery) => {
    //     // Это будет вызвано только если data не совпала с feedback_* или lead_*
    //     if (!callbackQuery.data.startsWith('feedback_') && !callbackQuery.data.startsWith('lead_')) {
    //         logger.warn(`[TelegramRouter][Callbacks] Необработанный callback_query: ${callbackQuery.data}`);
    //         try {
    //             await bot.answerCallbackQuery(callbackQuery.id);
    //         } catch (e) { /* ignore */ }
    //     }
    // });
}

module.exports = { register };