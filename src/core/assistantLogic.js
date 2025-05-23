const supabaseService = require('../services/supabaseService');
const openrouterService = require('../services/openrouterService');
const { SYSTEM_PROMPT_CONTENT } = require('../constants');
const logger = require('../utils/logger');

/**
 * Обрабатывает сообщение пользователя в контексте его текущего активного диалога.
 * @param {number} chatId - ID чата Telegram.
 * @param {number} userId - ID пользователя Telegram.
 * @param {string} userMessageText - Текст сообщения пользователя.
 * @returns {Promise<{text: string, dbId: number|string}|null>} Объект с текстом ответа и ID сообщения ассистента в БД, или null если произошла ошибка до возврата.
 * @throws {Error} Если не удалось обработать сообщение на каком-то из критических этапов.
 */
async function processUserMessage(chatId, userId, userMessageText) {
  const userMsgPreview = userMessageText.length > 50 ? `"${userMessageText.substring(0,50)}..."` : `"${userMessageText}"`;
  logger.info(`[CoreLogic][ChatID: ${chatId}, UserID: ${userId}] Обработка сообщения: ${userMsgPreview}`);

  let dialogueId; 
  try {
    dialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
    if (!dialogueId) {
      logger.error(`[CoreLogic][ChatID: ${chatId}, UserID: ${userId}] Не удалось получить/создать активный диалог.`);
      throw new Error('Не удалось начать или продолжить диалог.');
    }
    logger.info(`[CoreLogic][ChatID: ${chatId}, UserID: ${userId}] Работаем с DialogueID: ${dialogueId}`);

    await supabaseService.saveMessage(dialogueId, 'user', userMessageText);
    logger.info(`[CoreLogic][DialogueID: ${dialogueId}] Сообщение пользователя (role: user) сохранено.`);

    const dialogueMessagesForLLM = await supabaseService.getDialogueMessagesForLLM(dialogueId);
    logger.info(`[CoreLogic][DialogueID: ${dialogueId}] История диалога для LLM загружена, ${dialogueMessagesForLLM.length} сообщений из БД.`);

    const messagesForLLM = [
      { role: 'system', content: SYSTEM_PROMPT_CONTENT },
      ...dialogueMessagesForLLM, 
    ];
    
    logger.debug(`[CoreLogic][DialogueID: ${dialogueId}] Контекст для LLM (${messagesForLLM.length} сообщений).`);

    const assistantReplyText = await openrouterService.askOpenRouter(messagesForLLM, chatId); 
    logger.info(`[CoreLogic][DialogueID: ${dialogueId}] Ответ от ассистента получен.`);

    const savedAssistantMessage = await supabaseService.saveMessage(dialogueId, 'assistant', assistantReplyText);
    if (!savedAssistantMessage || !savedAssistantMessage.id) {
        logger.error(`[CoreLogic][DialogueID: ${dialogueId}] Ошибка: не удалось получить ID сохраненного сообщения ассистента.`);
        throw new Error('Не удалось сохранить ID ответа ассистента.');
    }
    logger.info(`[CoreLogic][DialogueID: ${dialogueId}] Ответ ассистента сохранен, DB_MsgID: ${savedAssistantMessage.id}.`);

    return { text: assistantReplyText, dbId: savedAssistantMessage.id };
  } catch (error) {
    const logPrefix = dialogueId ? `[CoreLogic][DialogueID: ${dialogueId}]` : `[CoreLogic][ChatID: ${chatId}, UserID: ${userId}]`;
    logger.error(`${logPrefix} Ошибка в processUserMessage:`, error);
    // Важно пробросить ошибку, чтобы telegram/handlers.js мог отправить пользователю сообщение об ошибке.
    // Если мы не пробросим, handlers.js получит undefined и может повести себя не так, как ожидается.
    throw error; 
  }
}

/**
 * Создает новый диалог для пользователя.
 * @param {number} chatId - ID чата Telegram.
 * @param {number} userId - ID пользователя Telegram.
 * @returns {Promise<string|null>} ID нового диалога или null.
 */
async function startNewUserDialogue(chatId, userId) {
    logger.info(`[CoreLogic][ChatID: ${chatId}, UserID: ${userId}] Запрос на создание нового диалога.`);
    try {
        const newDialogueId = await supabaseService.createNewDialogue(chatId, userId);
        return newDialogueId;
    } catch (error) {
        logger.error(`[CoreLogic][ChatID: ${chatId}, UserID: ${userId}] Ошибка при создании нового диалога:`, error);
        return null;
    }
}

module.exports = {
  processUserMessage,
  startNewUserDialogue,
};