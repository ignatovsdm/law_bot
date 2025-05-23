const assistantLogic = require('../core/assistantLogic');
const supabaseService = require('../services/supabaseService'); 
const logger =require('../utils/logger');
const {
  GREETING_MESSAGE,
  GENERAL_ERROR_MESSAGE,
  USER_TYPING_ACTION,
  NEW_DIALOGUE_SUCCESS,
  NEW_DIALOGUE_FAIL,
  FEEDBACK_REQUEST_MESSAGE, 
  FEEDBACK_POSITIVE_TEXT,
  FEEDBACK_NEGATIVE_TEXT,
  // FEEDBACK_THANKS_MESSAGE, // Больше не нужен здесь, т.к. callback обрабатывается в bot.js
  MIN_LENGTH_FOR_FEEDBACK_REQUEST,
} = require('../constants');

// Вспомогательная функция для получения информации о пользователе для логов
function getUserLogInfo(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const userName = msg.from.username || `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || `UserID:${userId}`;
    return `от ${userName} (ChatID: ${chatId}, UserID: ${userId})`;
}

// --- Клавиатура с меню ---
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '✨ Новый диалог' }],
    ],
    resize_keyboard: true, 
    one_time_keyboard: false, 
  },
};

/**
 * Вспомогательная функция для сохранения команды пользователя.
 */
async function saveUserCommand(chatId, userId, commandText) {
    try {
        const dialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
        if (dialogueId) {
            await supabaseService.saveMessage(dialogueId, 'user_command', commandText);
            logger.info(`[Telegram][Handler][DialogueID: ${dialogueId}] Команда "${commandText}" сохранена.`);
        } else {
            logger.warn(`[Telegram][Handler][ChatID: ${chatId}, UserID: ${userId}] Не удалось получить dialogueId для сохранения команды "${commandText}". Команда НЕ сохранена.`);
        }
    } catch (error) {
        logger.error(`[Telegram][Handler][ChatID: ${chatId}, UserID: ${userId}] Ошибка при сохранении команды "${commandText}":`, error);
    }
}

/**
 * Отправляет запрос на оценку ответа, если ответ соответствует критериям.
 */
async function requestFeedbackIfNeeded(bot, chatId, assistantReplyText, assistantMessageDbId) {
    if (!assistantMessageDbId) {
        logger.warn(`[Telegram][Feedback][ChatID: ${chatId}] Нет ID сообщения ассистента для запроса оценки.`);
        return;
    }
    if (assistantReplyText && assistantReplyText.length >= MIN_LENGTH_FOR_FEEDBACK_REQUEST) {
        logger.info(`[Telegram][Feedback][ChatID: ${chatId}] Ответ длинный (${assistantReplyText.length} симв.), запрашиваем оценку для MessageDB_ID: ${assistantMessageDbId}.`);
        try {
            await bot.sendMessage(chatId, FEEDBACK_REQUEST_MESSAGE, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: FEEDBACK_POSITIVE_TEXT, callback_data: `feedback_positive_${assistantMessageDbId}` },
                            { text: FEEDBACK_NEGATIVE_TEXT, callback_data: `feedback_negative_${assistantMessageDbId}` },
                        ],
                    ],
                },
            });
        } catch (error) {
            logger.error(`[Telegram][Feedback][ChatID: ${chatId}] Ошибка при отправке запроса на оценку:`, error);
        }
    } else {
        const length = assistantReplyText ? assistantReplyText.length : 0;
        logger.info(`[Telegram][Feedback][ChatID: ${chatId}] Ответ короткий (${length} симв.) или пустой, оценка не запрашивается для MessageDB_ID: ${assistantMessageDbId}.`);
    }
}


function registerEventHandlers(bot) {
  // --- Обработчики команд ---
  bot.onText(/\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    logger.log(`[Telegram][Handler] Команда /start ${getUserLogInfo(msg)}`);
    
    await saveUserCommand(chatId, userId, '/start');

    bot.sendMessage(chatId, GREETING_MESSAGE, mainKeyboard)
      .then(() => logger.info(`[Telegram][Handler][ChatID: ${chatId}] Отправлено приветствие с меню.`))
      .catch(err => logger.error(`[Telegram][Handler][ChatID: ${chatId}] Ошибка отправки приветствия:`, err));
  });

  const handleNewDialogue = async (msg, commandTextOverride) => { 
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const commandText = commandTextOverride || msg.text; 
    logger.log(`[Telegram][Handler] Запрос "Новый диалог" (текст: "${commandText}") ${getUserLogInfo(msg)}`);
    
    await saveUserCommand(chatId, userId, commandText);

    try {
        const newDialogueId = await assistantLogic.startNewUserDialogue(chatId, userId);
        if (newDialogueId) {
            await bot.sendMessage(chatId, NEW_DIALOGUE_SUCCESS, mainKeyboard);
            logger.info(`[Telegram][Handler][ChatID: ${chatId}] Успешно создан новый диалог ${newDialogueId}.`);
        } else {
            await bot.sendMessage(chatId, NEW_DIALOGUE_FAIL, mainKeyboard);
            logger.warn(`[Telegram][Handler][ChatID: ${chatId}] Не удалось создать новый диалог.`);
        }
    } catch (error) {
        logger.error(`[Telegram][Handler][ChatID: ${chatId}] Ошибка при обработке "Новый диалог":`, error);
        bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard)
            .catch(e => logger.error(`[Telegram][Handler][ChatID: ${chatId}] КРИТИЧЕСКАЯ ОШИБКА отправки сообщения:`, e));
    }
  };

  bot.onText(/\/new$/, (msg) => handleNewDialogue(msg, '/new'));

  // --- Общий обработчик сообщений ---
  // Обратите внимание: обработчик для '✨ Новый диалог' теперь является частью этого общего обработчика
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();
    const messageId = msg.message_id; 
    
    const userLogInfoString = getUserLogInfo(msg);

    // 1. Обработка текстовых кнопок
    if (text === '✨ Новый диалог') {
        handleNewDialogue(msg); // handleNewDialogue сама сохранит команду
        return; 
    }

    // 2. Игнорирование команд (которые должны обрабатываться onText) и пустых сообщений
    if (!text || text.startsWith('/')) {
      if (text && !['/start', '/new'].some(cmd => text.startsWith(cmd))) { 
        logger.log(`[Telegram][Handler] Получена неизвестная команда "${text}" ${userLogInfoString}. Игнорируется для LLM.`);
      } else if (!text) {
        logger.log(`[Telegram][Handler] Получено пустое/нетекстовое сообщение ${userLogInfoString} (MsgID: ${messageId}). Игнорируется.`);
      }
      return; 
    }

    // Если дошли сюда, это обычное текстовое сообщение для LLM
    const textPreview = text.length > 70 ? `"${text.substring(0, 70)}..."` : `"${text}"`;
    logger.log(`[Telegram][Handler] Сообщение для LLM ${userLogInfoString} (MsgID: ${messageId}): ${textPreview}`);

    bot.sendChatAction(chatId, USER_TYPING_ACTION)
        .catch(err => logger.warn(`[Telegram][Handler][ChatID: ${chatId}] Не удалось отправить '${USER_TYPING_ACTION}':`, err));

    try {
      const assistantResponse = await assistantLogic.processUserMessage(chatId, userId, text);
      
      if (assistantResponse && assistantResponse.text && typeof assistantResponse.dbId !== 'undefined') {
          await bot.sendMessage(chatId, assistantResponse.text, mainKeyboard);
          logger.info(`[Telegram][Handler][ChatID: ${chatId}] Ответ ассистента отправлен (длина: ${assistantResponse.text.length}). DB_MsgID: ${assistantResponse.dbId}`);
          
          await requestFeedbackIfNeeded(bot, chatId, assistantResponse.text, assistantResponse.dbId);
      } else {
          logger.error(`[Telegram][Handler][ChatID: ${chatId}] Получен некорректный ответ или отсутствует ID от assistantLogic. Response: ${JSON.stringify(assistantResponse)}`);
          await bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard);
      }

    } catch (error) {
      logger.error(`[Telegram][Handler][ChatID: ${chatId}] Ошибка обработки сообщения в главном обработчике (после assistantLogic):`, error);
      bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard)
        .catch(e => logger.error(`[Telegram][Handler][ChatID: ${chatId}] КРИТИЧЕСКАЯ ОШИБКА: Не удалось отправить сообщение об общей ошибке пользователю:`, e));
    }
  });

  // !!!!! ОБРАБОТЧИК CALLBACK_QUERY УДАЛЕН ОТСЮДА !!!!!
}

module.exports = {
  registerEventHandlers,
};