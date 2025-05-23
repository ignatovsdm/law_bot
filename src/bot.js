// src/bot.js
const config = require('./config'); 

const TelegramBot = require('node-telegram-bot-api');
// const { registerEventHandlers } = require('./telegram/handlers'); // Закомментируем для теста
const logger = require('./utils/logger');

logger.info('============================================================');
logger.info('[Система] Инициализация бота LegalBot...');
logger.info(`[Система] Уровень логирования: ${config.logLevel}`);

let bot;
try {
    bot = new TelegramBot(config.telegramToken, { 
        polling: {
            interval: 300, 
            autoStart: true,
            params: {
                timeout: 10, 
            }
        } 
    });
} catch (error) {
    logger.error('[Система] КРИТИЧЕСКАЯ ОШИБКА при инициализации TelegramBot API:', error);
    process.exit(1);
}

// !!!!! МИНИМАЛЬНЫЙ ТЕСТОВЫЙ ОБРАБОТЧИК CALLBACK_QUERY !!!!!
bot.on('callback_query', (callbackQuery) => {
    const cbqId = callbackQuery.id;
    const data = callbackQuery.data;
    const chatId = callbackQuery.message ? callbackQuery.message.chat.id : 'N/A';
    const userId = callbackQuery.from.id;

    logger.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
    logger.error(`[CALLBACK_QUERY_TEST][BOT.JS] ПОЛУЧЕН CALLBACK_QUERY!`);
    logger.error(`  ID: ${cbqId}`);
    logger.error(`  From UserID: ${userId}`);
    logger.error(`  ChatID: ${chatId}`);
    logger.error(`  Data: ${data}`);
    // logger.error(`  Full Object: ${JSON.stringify(callbackQuery, null, 2)}`);
    logger.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);

    bot.answerCallbackQuery(cbqId, { text: 'Callback received (test)' })
        .then(() => {
            logger.info(`[CALLBACK_QUERY_TEST][BOT.JS] Успешно отвечено на callback_query ID: ${cbqId}`);
        })
        .catch(err => {
            logger.error(`[CALLBACK_QUERY_TEST][BOT.JS] Ошибка ответа на callback_query ID: ${cbqId}`, err);
        });
});
// !!!!! КОНЕЦ МИНИМАЛЬНОГО ТЕСТОВОГО ОБРАБОТЧИКА !!!!!

// --- ПОЛНОСТЬЮ ЗАКОММЕНТИРОВАЛИ РЕГИСТРАЦИЮ ДРУГИХ ОБРАБОТЧИКОВ ---
// if (typeof registerEventHandlers === 'function') { 
//     logger.info('[Система] Регистрация стандартных обработчиков из handlers.js...');
//     registerEventHandlers(bot); 
// } else {
//     logger.error('[Система] Ошибка: registerEventHandlers не является функцией!');
// }
logger.warn('[Система][ТЕСТ] registerEventHandlers закомментирован для изоляции callback_query.');


bot.on('polling_error', (error) => {
  logger.error(`[TelegramBot][POLLING_ERROR] Код: ${error.code}. Сообщение: ${error.message}.`, error);
  if (error.response && error.response.body) {
      logger.error('[TelegramBot][POLLING_ERROR] Тело ответа от Telegram:', error.response.body);
  }
});

bot.on('webhook_error', (error) => { 
  logger.error(`[TelegramBot][WEBHOOK_ERROR] Код: ${error.code}. Сообщение: ${error.message}.`, error);
});

bot.on('error', (error) => {
    logger.error('[TelegramBot][GENERAL_BOT_ERROR] Произошла общая ошибка бота:', error);
});

logger.info(`[Система] Бот "${config.xTitle}" успешно запущен.`);
logger.info(`[Система] Используемая модель OpenRouter: ${config.openRouterModel}`);
logger.info('[Система] Ожидание сообщений... (Для остановки нажмите Ctrl+C)');
logger.info('============================================================');

function gracefulShutdown(signal) {
  logger.info(`[Система] Получен сигнал ${signal}. Завершение работы бота...`);
  setTimeout(() => {
    logger.info('[Система] Бот остановлен.');
    process.exit(0);
  }, 500);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT')); 
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (error, origin) => {
  logger.error(`[Система] НЕПЕРЕХВАЧЕННАЯ ОШИБКА (uncaughtException)! Origin: ${origin}`, error);
  process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Система] НЕОБРАБОТАННЫЙ REJECT В ПРОМИСЕ (unhandledRejection)!', reason instanceof Error ? reason : new Error(JSON.stringify(reason)));
});