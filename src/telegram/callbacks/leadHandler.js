// src/telegram/callbacks/leadHandler.js
const supabaseService = require('../../services/supabaseService');
const stateService = require('../../services/stateService');
const logger = require('../../utils/logger');
const { 
    LEAD_CONFIRM_YES, LEAD_CONFIRM_NO, CALLBACK_DATA_LEAD_YES, CALLBACK_DATA_LEAD_NO,
    LEAD_COLLECTION_START_MESSAGE, LEAD_PROMPT_NAME, GENERAL_ERROR_MESSAGE, LEAD_CANCELLED_MESSAGE,
    USER_STATE_AWAITING_LEAD_NAME, USER_STATE_AWAITING_LEAD_CONTACT_METHOD,
    LEAD_CONTACT_METHOD_TELEGRAM, LEAD_CONTACT_METHOD_WHATSAPP, LEAD_CONTACT_METHOD_EMAIL, LEAD_CONTACT_METHOD_CALL,
    CALLBACK_DATA_CONTACT_TELEGRAM, CALLBACK_DATA_CONTACT_WHATSAPP, CALLBACK_DATA_CONTACT_EMAIL, CALLBACK_DATA_CONTACT_CALL,
    LEAD_SUBMITTED_MESSAGE, LEAD_COLLECTION_COMPLETED_NEXT_PROMPT,
} = require('../../constants');
const { getUserLogInfo, editMarkupSafe, mainKeyboard } = require('../telegramUtils');

function register(bot) {
    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        if (!data || (
            !data.startsWith(CALLBACK_DATA_LEAD_YES) && 
            !data.startsWith(CALLBACK_DATA_LEAD_NO) && 
            !data.startsWith('lead_contact_'))) {
            return; 
        }

        const cbqId = callbackQuery.id;
        const originalMsg = callbackQuery.message;
        if (!originalMsg) { /* ... */ return; }

        const chatId = originalMsg.chat.id;
        const userId = callbackQuery.from.id;

        logger.info(`[CB][Lead] Data: ${data} ${getUserLogInfo(callbackQuery)}`);
        await editMarkupSafe(bot, chatId, originalMsg.message_id);

        // --- Ответ на предложение лида ---
        if (data.startsWith(CALLBACK_DATA_LEAD_YES) || data.startsWith(CALLBACK_DATA_LEAD_NO)) {
            const sessionState = stateService.getSessionState(userId); // Используется getSessionState - OK
            if (!sessionState || !sessionState.is_offering_lead) { // Проверка is_offering_lead - OK
                logger.warn(`[CB][LeadOffer] UserID: ${userId} ответил на предложение лида, но не в состоянии is_offering_lead. State: ${JSON.stringify(sessionState)}`);
                stateService.clearSessionState(userId); 
                await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[CB][LeadOffer] Error answering CBQ: ${e.message}`));
                return;
            }
            
            const sourceMessageDbIdFromCallback = parseInt(data.split('_')[2], 10);
            const sourceMessageDbId = !isNaN(sourceMessageDbIdFromCallback) ? sourceMessageDbIdFromCallback : sessionState.source_message_db_id;

            if (data.startsWith(CALLBACK_DATA_LEAD_YES)) {
                await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[CB][LeadOffer] Error answering CBQ: ${e.message}`));
                
                const dialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
                const newLead = await supabaseService.createLead({
                    user_id: userId, chat_id: chatId, dialogue_id: dialogueId,
                    source_message_id: sourceMessageDbId, 
                    initial_feedback_score: sessionState.initial_feedback_score,
                    status: 'collecting_info' 
                });

                if (newLead && newLead.id) {
                    stateService.startLeadCollection(userId, newLead.id); // Используется startLeadCollection - OK
                    await bot.sendMessage(chatId, LEAD_COLLECTION_START_MESSAGE);
                    await bot.sendMessage(chatId, LEAD_PROMPT_NAME);
                } else {
                    logger.error(`[CB][LeadOffer] UserID: ${userId} не удалось создать запись лида в БД.`);
                    await bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE);
                    stateService.clearSessionState(userId); 
                }
            } else if (data.startsWith(CALLBACK_DATA_LEAD_NO)) {
                await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[CB][LeadOffer] Error answering CBQ: ${e.message}`));
                await bot.sendMessage(chatId, LEAD_CANCELLED_MESSAGE);
                stateService.clearSessionState(userId); 
            }
            return; 
        }
        
        // --- Выбор способа связи ---
        if (data.startsWith('lead_contact_')) {
            const sessionState = stateService.getSessionState(userId); // Используется getSessionState - OK
            if (!sessionState || sessionState.current_state !== USER_STATE_AWAITING_LEAD_CONTACT_METHOD || !sessionState.lead_id) {
                logger.warn(`[CB][LeadContact] UserID: ${userId} выбрал способ связи, но состояние некорректно. State: ${JSON.stringify(sessionState)}`);
                await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[CB][LeadContact] Error answering CBQ: ${e.message}`));
                return;
            }
            
            let contactMethodValue = ''; 
            if (data === CALLBACK_DATA_CONTACT_TELEGRAM) contactMethodValue = 'telegram';
            else if (data === CALLBACK_DATA_CONTACT_WHATSAPP) contactMethodValue = 'whatsapp';
            else if (data === CALLBACK_DATA_CONTACT_EMAIL) contactMethodValue = 'email';
            else if (data === CALLBACK_DATA_CONTACT_CALL) contactMethodValue = 'call';
            else { /* ... */ return; }
            
            const leadDataToSave = { 
                ...(sessionState.lead_data || {}), 
                preferred_contact_method: contactMethodValue,
                status: 'collected'
            };
            // stateService.updateUserStateLeadData(userId, { preferred_contact_method: contactMethodValue }); // Это обновит только состояние в памяти, БД обновляется ниже
            
            const success = await supabaseService.updateLead(sessionState.lead_id, leadDataToSave);

            if (success) {
                const leadIdForUser = sessionState.lead_id.substring(0, 8); 
                await bot.sendMessage(chatId, LEAD_SUBMITTED_MESSAGE.replace('%LEAD_ID%', leadIdForUser));
                await bot.sendMessage(chatId, LEAD_COLLECTION_COMPLETED_NEXT_PROMPT, mainKeyboard); 
            } else { /* ... */ }
            stateService.clearSessionState(userId); 
            await bot.answerCallbackQuery(cbqId).catch(e => logger.warn(`[CB][LeadContact] Error answering CBQ: ${e.message}`));
            return;
        }
    });
}
module.exports = { register };