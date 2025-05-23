// src/telegram/callbacks/feedbackHandler.js
const supabaseService = require('../../services/supabaseService');
const stateService = require('../../services/stateService');
const logger = require('../../utils/logger');
const { 
    FEEDBACK_THANKS_MESSAGE, 
    LEAD_PROMPT_POSITIVE_FEEDBACK, 
    LEAD_PROMPT_NEGATIVE_FEEDBACK,
    LEAD_CONFIRM_YES,
    LEAD_CONFIRM_NO,
    CALLBACK_DATA_LEAD_YES,
    CALLBACK_DATA_LEAD_NO,
    LEAD_ALREADY_SUBMITTED_IN_DIALOGUE,
    GENERAL_ERROR_MESSAGE,
} = require('../../constants');
const { getUserLogInfo, editMarkupSafe, mainKeyboard } = require('../telegramUtils');

function register(bot) {
    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        if (!data || !data.startsWith('feedback_')) return; 

        const cbqId = callbackQuery.id;
        const originalMsg = callbackQuery.message;
        if (!originalMsg) { 
            logger.error(`[CB][Feedback] Нет message в callbackQuery. Data: ${data} ${getUserLogInfo(callbackQuery)}`);
            await bot.answerCallbackQuery(cbqId, {text: "Ошибка запроса."}).catch(e => logger.warn("Error answering CBQ", e));
            return; 
        }

        const chatId = originalMsg.chat.id;
        const userId = callbackQuery.from.id;

        logger.info(`[CB][Feedback] Data: ${data} ${getUserLogInfo(callbackQuery)}`);
        await editMarkupSafe(bot, chatId, originalMsg.message_id); 

        const parts = data.split('_');
        if (parts.length !== 3) { 
            logger.warn(`[CB][Feedback] Некорректный формат data: ${data}. ChatID: ${chatId}`);
            await bot.answerCallbackQuery(cbqId).catch(e => logger.warn("Error answering CBQ", e));
            return; 
        }

        const feedbackType = parts[1];
        const messageDbId = parseInt(parts[2], 10);
        if (isNaN(messageDbId)) { 
            logger.warn(`[CB][Feedback] Некорректный messageDbId: ${parts[2]}. ChatID: ${chatId}`);
            await bot.answerCallbackQuery(cbqId).catch(e => logger.warn("Error answering CBQ", e));
            return; 
        }

        let score;
        let leadPromptMessageText;

        if (feedbackType === 'positive') {
            score = 1;
            leadPromptMessageText = LEAD_PROMPT_POSITIVE_FEEDBACK;
        } else if (feedbackType === 'negative') {
            score = -1;
            leadPromptMessageText = LEAD_PROMPT_NEGATIVE_FEEDBACK;
        } else { 
            logger.warn(`[CB][Feedback] Неизвестный тип feedback: ${feedbackType}. ChatID: ${chatId}`);
            await bot.answerCallbackQuery(cbqId).catch(e => logger.warn("Error answering CBQ", e));
            return; 
        }

        try {
            const success = await supabaseService.updateMessageFeedback(messageDbId, score);
            if (success) {
                await bot.answerCallbackQuery(cbqId, { text: FEEDBACK_THANKS_MESSAGE });
                logger.info(`[CB][Feedback] Оценка для MessageDB_ID: ${messageDbId} сохранена как ${score}. ChatID: ${chatId}.`);
                
                const currentDialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
                if (currentDialogueId) {
                    const existingLead = await supabaseService.findCollectedLeadByDialogueId(currentDialogueId);
                    if (existingLead) {
                        logger.info(`[CB][Feedback] Лид уже собран для DialogueID: ${currentDialogueId}. LeadID: ${existingLead.id}`);
                        await bot.sendMessage(chatId, LEAD_ALREADY_SUBMITTED_IN_DIALOGUE, mainKeyboard);
                        return;
                    }
                }

                stateService.startLeadOffer(userId, messageDbId, score); // Используется startLeadOffer - OK
                await bot.sendMessage(chatId, leadPromptMessageText, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: LEAD_CONFIRM_YES, callback_data: `${CALLBACK_DATA_LEAD_YES}_${messageDbId}` },
                             { text: LEAD_CONFIRM_NO, callback_data: `${CALLBACK_DATA_LEAD_NO}_${messageDbId}` }]
                        ]
                    }
                });
            } else { 
                await bot.answerCallbackQuery(cbqId, { text: 'Не удалось сохранить оценку.' });
                logger.error(`[CB][Feedback] Ошибка БД при сохранении оценки для MessageDB_ID: ${messageDbId}. ChatID: ${chatId}.`);
            }
        } catch (error) { 
            logger.error(`[CB][Feedback] Общая ошибка при обработке feedback: ChatID: ${chatId}:`, error);
            await bot.answerCallbackQuery(cbqId, { text: GENERAL_ERROR_MESSAGE }).catch(e => logger.warn(`[CB][Feedback] Error answering CBQ: ${e.message}`));
        }
    });
}

module.exports = { register };