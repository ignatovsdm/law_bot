// src/telegram/handlers.js
const assistantLogic = require('../core/assistantLogic');
const supabaseService = require('../services/supabaseService'); 
const logger =require('../utils/logger');
const stateService = require('../services/stateService'); 
const {
  GREETING_MESSAGE,
  GENERAL_ERROR_MESSAGE,
  USER_TYPING_ACTION,
  NEW_DIALOGUE_SUCCESS,
  NEW_DIALOGUE_FAIL,
  FEEDBACK_REQUEST_MESSAGE, 
  FEEDBACK_POSITIVE_TEXT,
  FEEDBACK_NEGATIVE_TEXT,
  FEEDBACK_THANKS_MESSAGE,
  MIN_LENGTH_FOR_FEEDBACK_REQUEST,
  LEAD_PROMPT_POSITIVE_FEEDBACK,
  LEAD_PROMPT_NEGATIVE_FEEDBACK,
  LEAD_CONFIRM_YES,
  LEAD_CONFIRM_NO,
  LEAD_ALREADY_SUBMITTED_IN_DIALOGUE, // <--- Используем
  LEAD_COLLECTION_START_MESSAGE,
  LEAD_PROMPT_NAME,
  LEAD_PROMPT_PHONE,
  LEAD_PROMPT_EMAIL,
  LEAD_PROMPT_CONTACT_METHOD,
  LEAD_CONTACT_METHOD_TELEGRAM,
  LEAD_CONTACT_METHOD_WHATSAPP,
  LEAD_CONTACT_METHOD_EMAIL,
  LEAD_CONTACT_METHOD_CALL,
  LEAD_SUBMITTED_MESSAGE,
  LEAD_CANCELLED_MESSAGE,
  LEAD_COLLECTION_COMPLETED_NEXT_PROMPT, // <--- Используем
  CALLBACK_DATA_LEAD_YES,
  CALLBACK_DATA_LEAD_NO,
  CALLBACK_DATA_CONTACT_TELEGRAM,
  CALLBACK_DATA_CONTACT_WHATSAPP,
  CALLBACK_DATA_CONTACT_EMAIL,
  CALLBACK_DATA_CONTACT_CALL,
  USER_STATE_AWAITING_LEAD_NAME,
  USER_STATE_AWAITING_LEAD_PHONE,
  USER_STATE_AWAITING_LEAD_EMAIL,
  USER_STATE_AWAITING_LEAD_CONTACT_METHOD,
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
    keyboard: [[{ text: '✨ Новый диалог' }]],
    resize_keyboard: true, one_time_keyboard: false, 
  },
};
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
                        [{ text: FEEDBACK_POSITIVE_TEXT, callback_data: `feedback_positive_${assistantMessageDbId}` },
                         { text: FEEDBACK_NEGATIVE_TEXT, callback_data: `feedback_negative_${assistantMessageDbId}` }]
                    ]
                }
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
  bot.onText(/\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    logger.log(`[Telegram][Handler] Команда /start ${getUserLogInfo(msg)}`);
    
    await saveUserCommand(chatId, userId, '/start');
    stateService.clearUserState(userId); 

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
    stateService.clearUserState(userId); 

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

  bot.on('callback_query', async (callbackQuery) => {
    const cbqId = callbackQuery.id;
    const originalMsg = callbackQuery.message; 
    if (!originalMsg) {
        logger.error(`[Telegram][Callback][HANDLER.JS] Отсутствует объект message в callbackQuery. ID: ${cbqId} ${getUserLogInfo(callbackQuery)}`);
        bot.answerCallbackQuery(cbqId, {text: "Ошибка обработки запроса."}).catch(e => logger.warn(`[Telegram][Callback] Error answering CBQ (no msg): ${e.message}`));
        return;
    }
    const chatId = originalMsg.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data; 

    logger.info(`[Telegram][Callback][HANDLER.JS] Получен callback_query. Data: ${data} ${getUserLogInfo(callbackQuery)}`);

    const editMarkup = async (newReplyMarkup = { inline_keyboard: [] }) => {
        try {
            await bot.editMessageReplyMarkup(newReplyMarkup, { chat_id: chatId, message_id: originalMsg.message_id });
        } catch (editError) {
            if (editError.response && editError.response.statusCode === 400 && editError.response.body.description.includes("message is not modified")) {
                // logger.info(`[Telegram][Callback] Кнопки уже были изменены/удалены для msg_id: ${originalMsg.message_id}`);
            } else {
                logger.warn(`[Telegram][Callback] Ошибка при попытке изменить inline кнопки: ${editError.message} для msg_id: ${originalMsg.message_id}`);
            }
        }
    };
    
    if (data.startsWith('feedback_')) {
        await editMarkup(); 

        const parts = data.split('_');
        if (parts.length !== 3 || parts[0] !== 'feedback') { /* ... */ return; }

        const feedbackType = parts[1];
        const messageDbId = parseInt(parts[2], 10);
        if (isNaN(messageDbId)) { /* ... */ return; }

        let score;
        let leadPromptMessageText;

        if (feedbackType === 'positive') {
            score = 1;
            leadPromptMessageText = LEAD_PROMPT_POSITIVE_FEEDBACK;
        } else if (feedbackType === 'negative') {
            score = -1;
            leadPromptMessageText = LEAD_PROMPT_NEGATIVE_FEEDBACK;
        } else { /* ... */ return; }

        try {
            const success = await supabaseService.updateMessageFeedback(messageDbId, score);
            if (success) {
                await bot.answerCallbackQuery(cbqId, { text: FEEDBACK_THANKS_MESSAGE });
                logger.info(`[Telegram][Callback][HANDLER.JS][ChatID: ${chatId}] Оценка для MessageDB_ID: ${messageDbId} сохранена как ${score}.`);
                
                // ПРОВЕРКА НА СУЩЕСТВУЮЩИЙ ЛИД В ДИАЛОГЕ
                const currentDialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
                if (currentDialogueId) {
                    const existingLead = await supabaseService.findCollectedLeadByDialogueId(currentDialogueId);
                    if (existingLead) {
                        logger.info(`[Telegram][LeadOffer][UserID: ${userId}] Лид уже собран для DialogueID: ${currentDialogueId}. LeadID: ${existingLead.id}`);
                        await bot.sendMessage(chatId, LEAD_ALREADY_SUBMITTED_IN_DIALOGUE, mainKeyboard); // Используем mainKeyboard
                        return; // Не предлагаем новый лид
                    }
                }
                // Конец проверки

                stateService.setUserState(userId, { 
                    pendingLeadOffer: true, 
                    sourceMessageDbId: messageDbId, 
                    initialFeedbackScore: score 
                });
                await bot.sendMessage(chatId, leadPromptMessageText, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: LEAD_CONFIRM_YES, callback_data: `${CALLBACK_DATA_LEAD_YES}_${messageDbId}` },
                             { text: LEAD_CONFIRM_NO, callback_data: `${CALLBACK_DATA_LEAD_NO}_${messageDbId}` }]
                        ]
                    }
                });
            } else { /* ... */ }
        } catch (error) { /* ... */ }
        return;
    }

    if (data.startsWith(CALLBACK_DATA_LEAD_YES) || data.startsWith(CALLBACK_DATA_LEAD_NO)) {
        await editMarkup(); 

        const stateData = stateService.getUserState(userId); 
        if (!stateData || !stateData.pendingLeadOffer) { /* ... */ return; }
        
        const sourceMessageDbIdFromCallback = parseInt(data.split('_')[2], 10);
        const sourceMessageDbId = !isNaN(sourceMessageDbIdFromCallback) ? sourceMessageDbIdFromCallback : stateData.sourceMessageDbId;

        if (data.startsWith(CALLBACK_DATA_LEAD_YES)) {
            await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[Telegram][Callback] Error answering CBQ: ${e.message}`));
            logger.info(`[Telegram][Callback][HANDLER.JS][UserID: ${userId}] Пользователь согласился оставить заявку.`);
            
            const dialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
            const newLead = await supabaseService.createLead({
                user_id: userId,
                chat_id: chatId,
                dialogue_id: dialogueId,
                source_message_id: sourceMessageDbId, 
                initial_feedback_score: stateData.initialFeedbackScore,
                status: 'collecting_info' 
            });

            if (newLead && newLead.id) {
                stateService.setUserState(userId, { 
                    state: USER_STATE_AWAITING_LEAD_NAME, 
                    leadId: newLead.id, 
                    data: {} 
                });
                await bot.sendMessage(chatId, LEAD_COLLECTION_START_MESSAGE);
                await bot.sendMessage(chatId, LEAD_PROMPT_NAME);
            } else { /* ... */ }
        } else if (data.startsWith(CALLBACK_DATA_LEAD_NO)) { /* ... */ }
        return; 
    }
    
    if (data.startsWith('lead_contact_')) {
        await editMarkup(); 

        const currentState = stateService.getUserState(userId); 
        if (!currentState || currentState.state !== USER_STATE_AWAITING_LEAD_CONTACT_METHOD || !currentState.leadId) { /* ... */ return; }
        
        let contactMethodValue = ''; 
        if (data === CALLBACK_DATA_CONTACT_TELEGRAM) contactMethodValue = 'telegram';
        else if (data === CALLBACK_DATA_CONTACT_WHATSAPP) contactMethodValue = 'whatsapp';
        else if (data === CALLBACK_DATA_CONTACT_EMAIL) contactMethodValue = 'email';
        else if (data === CALLBACK_DATA_CONTACT_CALL) contactMethodValue = 'call';
        else { /* ... */ return; }

        const leadDataToSave = { 
            name: currentState.data.name, 
            phone: currentState.data.phone,
            email: currentState.data.email,
            preferred_contact_method: contactMethodValue,
            status: 'collected'
        };
        stateService.updateUserStateLeadData(userId, { preferred_contact_method: contactMethodValue });
        
        const success = await supabaseService.updateLead(currentState.leadId, leadDataToSave);

        if (success) {
            const leadIdForUser = currentState.leadId.substring(0, 8); 
            await bot.sendMessage(chatId, LEAD_SUBMITTED_MESSAGE.replace('%LEAD_ID%', leadIdForUser));
            // СООБЩЕНИЕ ПОСЛЕ СБОРА ЛИДА
            await bot.sendMessage(chatId, LEAD_COLLECTION_COMPLETED_NEXT_PROMPT, mainKeyboard); 
            logger.info(`[Telegram][Callback][HANDLER.JS][UserID: ${userId}] Лид ${currentState.leadId} полностью собран и сохранен.`);
        } else { /* ... */ }
        stateService.clearUserState(userId); 
        await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[Telegram][Callback] Error answering CBQ: ${e.message}`));
        return;
    }

    logger.warn(`[Telegram][Callback][HANDLER.JS][ChatID: ${chatId}] Необработанный callback_data: ${data}`);
    await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[Telegram][Callback] Error answering CBQ: ${e.message}`));
  });


  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();
    
    const currentState = stateService.getUserState(userId); 
    if (currentState && currentState.leadId && currentState.state) { 
        logger.info(`[Telegram][LeadCollection][UserID: ${userId}] В состоянии ${currentState.state}, получено: "${text}"`);
        
        let nextState = currentState.state; 
        let promptMessage = null;
        let fieldToUpdate = null;
        let valueToUpdate = null;
        let shouldSaveToDb = false;

        switch (currentState.state) {
            case USER_STATE_AWAITING_LEAD_NAME:
                if (!text) { await bot.sendMessage(chatId, "Имя не может быть пустым. "+LEAD_PROMPT_NAME); return; }
                fieldToUpdate = 'name'; valueToUpdate = text;
                nextState = USER_STATE_AWAITING_LEAD_PHONE;
                promptMessage = LEAD_PROMPT_PHONE;
                shouldSaveToDb = true;
                break;
            case USER_STATE_AWAITING_LEAD_PHONE:
                if (!text) { await bot.sendMessage(chatId, "Телефон не может быть пустым. "+LEAD_PROMPT_PHONE); return; }
                fieldToUpdate = 'phone'; valueToUpdate = text;
                nextState = USER_STATE_AWAITING_LEAD_EMAIL;
                promptMessage = LEAD_PROMPT_EMAIL;
                shouldSaveToDb = true;
                break;
            case USER_STATE_AWAITING_LEAD_EMAIL:
                if (!text) { await bot.sendMessage(chatId, "Email не может быть пустым. "+LEAD_PROMPT_EMAIL); return; }
                fieldToUpdate = 'email'; valueToUpdate = text;
                nextState = USER_STATE_AWAITING_LEAD_CONTACT_METHOD;
                promptMessage = LEAD_PROMPT_CONTACT_METHOD; 
                shouldSaveToDb = true;
                break;
            default:
                logger.warn(`[Telegram][LeadCollection][UserID: ${userId}] Неизвестное/необрабатываемое текстовым вводом состояние сбора лида: ${currentState.state}`);
                return; 
        }
        
        if (shouldSaveToDb && fieldToUpdate) {
            stateService.updateUserStateLeadData(userId, { [fieldToUpdate]: valueToUpdate }); 
            await supabaseService.updateLead(currentState.leadId, { [fieldToUpdate]: valueToUpdate }); 
            
            stateService.setUserState(userId, { 
                ...stateService.getUserState(userId), 
                state: nextState,
            });
        }

        if (nextState === USER_STATE_AWAITING_LEAD_CONTACT_METHOD) {
            await bot.sendMessage(chatId, promptMessage, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: LEAD_CONTACT_METHOD_TELEGRAM, callback_data: CALLBACK_DATA_CONTACT_TELEGRAM }],
                        [{ text: LEAD_CONTACT_METHOD_WHATSAPP, callback_data: CALLBACK_DATA_CONTACT_WHATSAPP }],
                        [{ text: LEAD_CONTACT_METHOD_EMAIL, callback_data: CALLBACK_DATA_CONTACT_EMAIL }],
                        [{ text: LEAD_CONTACT_METHOD_CALL, callback_data: CALLBACK_DATA_CONTACT_CALL }]
                    ]
                }
            });
        } else if (promptMessage) {
            await bot.sendMessage(chatId, promptMessage);
        }
        return; 
    }

    const userLogInfoString = getUserLogInfo(msg);
    const messageId = msg.message_id;

    if (text === '✨ Новый диалог') {
        handleNewDialogue(msg); 
        return; 
    }

    if (!text || text.startsWith('/')) { /* ... */ return; }

    const textPreview = text.length > 70 ? `"${text.substring(0, 70)}..."` : `"${text}"`;
    logger.log(`[Telegram][Handler] Сообщение для LLM ${userLogInfoString} (MsgID: ${messageId}): ${textPreview}`);

    bot.sendChatAction(chatId, USER_TYPING_ACTION)
        .catch(err => logger.warn(`[Telegram][Handler][ChatID: ${chatId}] Не удалось отправить '${USER_TYPING_ACTION}':`, err.message));

    try {
      const assistantResponse = await assistantLogic.processUserMessage(chatId, userId, text);
      
      if (assistantResponse && assistantResponse.text && typeof assistantResponse.dbId !== 'undefined') {
          await bot.sendMessage(chatId, assistantResponse.text, mainKeyboard);
          logger.info(`[Telegram][Handler][ChatID: ${chatId}] Ответ ассистента отправлен (длина: ${assistantResponse.text.length}). DB_MsgID: ${assistantResponse.dbId}`);
          await requestFeedbackIfNeeded(bot, chatId, assistantResponse.text, assistantResponse.dbId);
      } else { /* ... */ }
    } catch (error) { /* ... */ }
  });
}

module.exports = {
  registerEventHandlers,
};