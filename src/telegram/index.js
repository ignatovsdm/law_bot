// src/telegram/index.js
const logger = require('../utils/logger');

const commandHandlers = require('./commands'); // index.js в commands/
const messageHandlers = require('./messages'); // index.js в messages/
const callbackQueryHandlers = require('./callbacks'); // index.js в callbacks/

function registerEventHandlers(bot) {
    logger.info('[TelegramRouter] Регистрация обработчиков команд...');
    commandHandlers.register(bot);

    logger.info('[TelegramRouter] Регистрация обработчиков callback-запросов...');
    callbackQueryHandlers.register(bot); // <--- ВАЖНО: Регистрируем до messageHandlers

    logger.info('[TelegramRouter] Регистрация обработчиков сообщений...');
    messageHandlers.register(bot); // <--- Обработчик сообщений должен быть последним из `on('message')`

    logger.info('[TelegramRouter] Все обработчики Telegram зарегистрированы.');
}

module.exports = {
    registerEventHandlers,
};