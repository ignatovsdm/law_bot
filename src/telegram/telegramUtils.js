// src/telegram/telegramUtils.js
const supabaseService = require('../services/supabaseService');
const logger = require('../utils/logger');
const {
    FEEDBACK_REQUEST_MESSAGE,
    FEEDBACK_POSITIVE_TEXT,
    FEEDBACK_NEGATIVE_TEXT,
    MIN_LENGTH_FOR_FEEDBACK_REQUEST,
    MAIN_MENU_NEW_DIALOGUE, // <--- Импортируем
    MAIN_MENU_LEAD_REQUEST, // <--- Импортируем
} = require('../constants');


function getUserLogInfo(msgOrQuery) {
    const from = msgOrQuery.from;
    const chat = msgOrQuery.message ? msgOrQuery.message.chat : msgOrQuery.chat; 
    if (!from || !chat) { return '(не удалось определить пользователя/чат)'; }
    const userId = from.id;
    const chatId = chat.id;
    const userName = from.username || `${from.first_name || ''} ${from.last_name || ''}`.trim() || `UserID:${userId}`;
    return `от ${userName} (ChatID: ${chatId}, UserID: ${userId})`;
}

const mainKeyboard = {
  reply_markup: {
    keyboard: [
      // Теперь две кнопки в одном ряду, или можно сделать два ряда
      [{ text: MAIN_MENU_NEW_DIALOGUE }, { text: MAIN_MENU_LEAD_REQUEST }], 
      // Либо так для двух рядов:
      // [{ text: MAIN_MENU_NEW_DIALOGUE }],
      // [{ text: MAIN_MENU_LEAD_REQUEST }],
    ],
    resize_keyboard: true, 
    one_time_keyboard: false, 
  },
};

async function saveUserCommand(chatId, userId, commandText) {
    try {
        const dialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
        if (dialogueId) {
            await supabaseService.saveMessage(dialogueId, 'user_command', commandText);
            // logger.info(`[TelegramUtils][SaveCmd] Команда "${commandText}" сохранена для DialogueID: ${dialogueId}.`);
        } else {
            logger.warn(`[TelegramUtils][SaveCmd] Не удалось получить dialogueId для UserID: ${userId}, ChatID: ${chatId}. Команда "${commandText}" НЕ сохранена.`);
        }
    } catch (error) {
        logger.error(`[TelegramUtils][SaveCmd] Ошибка при сохранении команды "${commandText}" для UserID: ${userId}, ChatID: ${chatId}:`, error);
    }
}

async function requestFeedbackIfNeededUtils(bot, chatId, assistantReplyText, assistantMessageDbId) {
    if (typeof assistantMessageDbId === 'undefined' || assistantMessageDbId === null) {
        logger.warn(`[TelegramUtils][Feedback] Нет ID сообщения ассистента для запроса оценки. ChatID: ${chatId}.`);
        return;
    }
    if (assistantReplyText && assistantReplyText.length >= MIN_LENGTH_FOR_FEEDBACK_REQUEST) {
        logger.info(`[TelegramUtils][Feedback] Ответ длинный (${assistantReplyText.length} симв.), запрашиваем оценку для MessageDB_ID: ${assistantMessageDbId}. ChatID: ${chatId}.`);
        try {
            await bot.sendMessage(chatId, FEEDBACK_REQUEST_MESSAGE, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: FEEDBACK_POSITIVE_TEXT, callback_data: `feedback_positive_${assistantMessageDbId}` },
                         { text: FEEDBACK_NEGATIVE_TEXT, callback_data: `feedback_negative_${assistantMessageDbId}` }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`[TelegramUtils][Feedback] Ошибка при отправке запроса на оценку ChatID: ${chatId}:`, error);
        }
    } else {
        const length = assistantReplyText ? assistantReplyText.length : 0;
        // logger.info(`[TelegramUtils][Feedback] Ответ короткий (${length} симв.) или пустой, оценка не запрашивается. MessageDB_ID: ${assistantMessageDbId}, ChatID: ${chatId}.`);
    }
}

async function editMarkupSafe(bot, chatId, messageId, newReplyMarkup = { inline_keyboard: [] }) {
    if (!messageId) {
        logger.warn(`[TelegramUtils][EditMarkup] Попытка изменить разметку для сообщения без ID. ChatID: ${chatId}`);
        return;
    }
    try {
        await bot.editMessageReplyMarkup(newReplyMarkup, { chat_id: chatId, message_id: messageId });
    } catch (editError) {
        if (editError.response && editError.response.statusCode === 400 && 
            (editError.response.body.description.includes("message is not modified") || 
             editError.response.body.description.includes("message to edit not found"))) {
        } else {
            logger.warn(`[TelegramUtils][EditMarkup] Ошибка при попытке изменить inline кнопки (msg_id: ${messageId}, ChatID: ${chatId}): ${editError.message}`);
        }
    }
}

module.exports = {
    getUserLogInfo,
    mainKeyboard,
    saveUserCommand,
    requestFeedbackIfNeededUtils,
    editMarkupSafe,
};