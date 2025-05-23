// minimal_test_any_user.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN; 

if (!token) {
    console.error("Пожалуйста, установите TELEGRAM_TOKEN в .env файле!");
    process.exit(1);
}

console.log(`[MinimalTestAnyUser] Инициализация с токеном: ${token.substring(0,10)}...`);
const bot = new TelegramBot(token, { polling: true });

// Отправляем сообщение с кнопками в ответ на любое сообщение, начинающееся с /testkb
bot.onText(/\/testkb(.*)/, (msg) => { // Принимаем команду от любого пользователя
    const chatIdForResponse = msg.chat.id; // Отвечаем тому, кто написал
    console.log(`[MinimalTestAnyUser] Получена команда /testkb от chat_id: ${chatIdForResponse}, user_id: ${msg.from.id}`);
    
    bot.sendMessage(chatIdForResponse, 'Тестовые inline кнопки (для любого пользователя):', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Кнопка А (pos)', callback_data: 'test_any_positive_777' },
                    { text: 'Кнопка Б (neg)', callback_data: 'test_any_negative_888' }
                ]
            ]
        }
    }).then(() => console.log(`[MinimalTestAnyUser] Сообщение с кнопками отправлено в чат ${chatIdForResponse}.`))
      .catch(err => console.error("[MinimalTestAnyUser] Ошибка отправки сообщения с кнопками:", err));
});

// Обработчик callback_query от ЛЮБОГО пользователя
bot.on('callback_query', (callbackQuery) => {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('[MinimalTestAnyUser] ПОЛУЧЕН CALLBACK_QUERY!');
    console.error(`  Data: ${callbackQuery.data}`);
    console.error(`  From UserID: ${callbackQuery.from.id}`);
    console.error(`  Message ChatID: ${callbackQuery.message ? callbackQuery.message.chat.id : 'N/A'}`);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

    bot.answerCallbackQuery(callbackQuery.id, { text: `Получено (any user): ${callbackQuery.data}` })
        .then(() => console.log("[MinimalTestAnyUser] Ответ на callback_query отправлен."))
        .catch(err => console.error("[MinimalTestAnyUser] Ошибка ответа на callback_query:", err));
});

bot.on('polling_error', (error) => {
    console.error('[MinimalTestAnyUser][POLLING_ERROR]', error.code, error.message, error);
});

console.log('[MinimalTestAnyUser] Минимальный бот (для любого пользователя) запущен. Отправьте /testkb в ваш чат с ботом.');