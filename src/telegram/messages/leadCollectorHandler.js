// src/telegram/messages/leadCollectorHandler.js
const supabaseService = require('../../services/supabaseService');
const stateService = require('../../services/stateService'); 
const logger = require('../../utils/logger');
const {
    USER_STATE_AWAITING_LEAD_NAME, USER_STATE_AWAITING_LEAD_PHONE, USER_STATE_AWAITING_LEAD_EMAIL,
    USER_STATE_AWAITING_LEAD_CONTACT_METHOD,
    LEAD_PROMPT_NAME, LEAD_PROMPT_PHONE, LEAD_PROMPT_EMAIL, LEAD_PROMPT_CONTACT_METHOD,
    LEAD_CONTACT_METHOD_TELEGRAM, LEAD_CONTACT_METHOD_WHATSAPP, LEAD_CONTACT_METHOD_EMAIL, LEAD_CONTACT_METHOD_CALL,
    CALLBACK_DATA_CONTACT_TELEGRAM, CALLBACK_DATA_CONTACT_WHATSAPP, CALLBACK_DATA_CONTACT_EMAIL, CALLBACK_DATA_CONTACT_CALL,
} = require('../../constants');

async function handle(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();

    const sessionState = stateService.getSessionState(userId); 
    
    if (sessionState && sessionState.lead_id && sessionState.current_state && 
        [USER_STATE_AWAITING_LEAD_NAME, USER_STATE_AWAITING_LEAD_PHONE, USER_STATE_AWAITING_LEAD_EMAIL].includes(sessionState.current_state)
    ) { 
        logger.info(`[Msg][LeadCollector] UserID: ${userId} в состоянии ${sessionState.current_state}, получено: "${text}"`);
        
        let nextStateKey = null; 
        let promptMessage = null;
        let fieldToUpdate = null; // Имя поля в lead_data и в БД (предполагаем совпадение)
        let valueToUpdate = text;
        
        switch (sessionState.current_state) {
            case USER_STATE_AWAITING_LEAD_NAME:
                if (!text) { await bot.sendMessage(chatId, "Имя не может быть пустым. " + LEAD_PROMPT_NAME); return true; }
                fieldToUpdate = 'name'; 
                nextStateKey = USER_STATE_AWAITING_LEAD_PHONE;
                promptMessage = LEAD_PROMPT_PHONE;
                break;
            case USER_STATE_AWAITING_LEAD_PHONE:
                if (!text) { await bot.sendMessage(chatId, "Телефон не может быть пустым. " + LEAD_PROMPT_PHONE); return true; }
                fieldToUpdate = 'phone'; 
                nextStateKey = USER_STATE_AWAITING_LEAD_EMAIL;
                promptMessage = LEAD_PROMPT_EMAIL;
                break;
            case USER_STATE_AWAITING_LEAD_EMAIL:
                if (!text) { await bot.sendMessage(chatId, "Email не может быть пустым. " + LEAD_PROMPT_EMAIL); return true; }
                fieldToUpdate = 'email'; 
                nextStateKey = USER_STATE_AWAITING_LEAD_CONTACT_METHOD;
                promptMessage = LEAD_PROMPT_CONTACT_METHOD; 
                break;
            default:
                return false; 
        }
        
        if (fieldToUpdate) {
            // Обновляем состояние в памяти
            stateService.updateLeadCollectionProgress(userId, { 
                fieldToUpdate: fieldToUpdate, 
                value: valueToUpdate, 
                nextStateKey: nextStateKey 
            });
            // Обновляем в БД
            await supabaseService.updateLead(sessionState.lead_id, { [fieldToUpdate]: valueToUpdate }); 
        } else if (nextStateKey) { // Если только переход состояния без обновления данных
             stateService.updateLeadCollectionProgress(userId, { nextStateKey: nextStateKey });
        }


        if (nextStateKey === USER_STATE_AWAITING_LEAD_CONTACT_METHOD) {
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
        return true; 
    }
    return false; 
}

module.exports = { handle };