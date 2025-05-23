// src/telegram/messages/defaultMessageHandler.js
const assistantLogic = require('../../core/assistantLogic');
const logger = require('../../utils/logger');
const { USER_TYPING_ACTION, GENERAL_ERROR_MESSAGE } = require('../../constants');
const { getUserLogInfo, mainKeyboard, requestFeedbackIfNeededUtils } = require('../telegramUtils');

/**
 * @returns {Promise<boolean>} true если сообщение было обработано.
 */
async function handle(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();

    // Эта проверка уже должна быть в messages/index.js, но на всякий случай
    if (!text || text.startsWith('/') || text === '✨ Новый диалог') {
        logger.warn(`[Msg][Default] Сообщение "${text}" не должно было попасть в defaultMessageHandler.`);
        return true; 
    }

    const userLogInfoString = getUserLogInfo(msg);
    const messageId = msg.message_id;

    const textPreview = text.length > 70 ? `"${text.substring(0, 70)}..."` : `"${text}"`;
    logger.log(`[Msg][Default] Сообщение для LLM ${userLogInfoString} (MsgID: ${messageId}): ${textPreview}`);

    bot.sendChatAction(chatId, USER_TYPING_ACTION)
        .catch(err => logger.warn(`[Msg][Default] Не удалось отправить '${USER_TYPING_ACTION}' ChatID: ${chatId}:`, err.message));

    try {
      const assistantResponse = await assistantLogic.processUserMessage(chatId, userId, text);
      
      if (assistantResponse && assistantResponse.text && typeof assistantResponse.dbId !== 'undefined') {
          await bot.sendMessage(chatId, assistantResponse.text, mainKeyboard);
          logger.info(`[Msg][Default] Ответ ассистента отправлен ChatID: ${chatId}. DB_MsgID: ${assistantResponse.dbId}`);
          await requestFeedbackIfNeededUtils(bot, chatId, assistantResponse.text, assistantResponse.dbId);
      } else {
          logger.error(`[Msg][Default] Получен некорректный ответ или отсутствует ID от assistantLogic. ChatID: ${chatId}.`);
          await bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard);
      }
    } catch (error) {
      logger.error(`[Msg][Default] Ошибка обработки сообщения ChatID: ${chatId}:`, error);
      bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard)
        .catch(e => logger.error(`[Msg][Default] КРИТ. ОШИБКА отправки сообщения ChatID: ${chatId}:`, e.message));
    }
    return true; 
}
module.exports = { handle };