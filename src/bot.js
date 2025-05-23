// src/bot.js
const config = require('./config'); 

const TelegramBot = require('node-telegram-bot-api');
const { registerEventHandlers } = require('./telegram/handlers');
const logger = require('./utils/logger');

// userStates БОЛЬШЕ НЕ ОБЪЯВЛЯЕТСЯ И НЕ ЭКСПОРТИРУЕТСЯ ОТСЮДА
// const userStates = {}; 
// module.exports.userStates = userStates; // УДАЛЕНО

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

if (typeof registerEventHandlers === 'function') {
    logger.info('[Система] Регистрация обработчиков событий Telegram...');
    registerEventHandlers(bot); // Передаем только bot, userStates теперь будет браться из stateService
} else {
    logger.error('[Система] Ошибка: registerEventHandlers не является функцией! Проверьте экспорт из src/telegram/handlers.js');
    process.exit(1);
}

bot.on('polling_error', (error) => {
  logger.error(`[TelegramBot][POLLING_ERROR] Код: ${error.code || 'Неизвестный код'}. Сообщение: ${error.message}.`, error);
  if (error.response && error.response.body) {
      logger.error('[TelegramBot][POLLING_ERROR] Тело ответа от Telegram:', error.response.body);
  }
});

bot.on('webhook_error', (error) => { 
  logger.error(`[TelegramBot][WEBHOOK_ERROR] Код: ${error.code || 'Неизвестный код'}. Сообщение: ${error.message}.`, error);
});

bot.on('error', (error) => {
    logger.error('[TelegramBot][GENERAL_BOT_ERROR] Произошла общая ошибка экземпляра бота:', error);
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
  logger.error(`[Система][FATAL] НЕПЕРЕХВАЧЕННАЯ ОШИБКА (uncaughtException)! Origin: ${origin}`, error);
  process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Система][FATAL] НЕОБРАБОТАННЫЙ REJECT В ПРОМИСЕ (unhandledRejection)!', reason instanceof Error ? reason : new Error(JSON.stringify(reason)));
});