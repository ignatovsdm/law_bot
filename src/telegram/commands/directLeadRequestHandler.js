// src/telegram/commands/directLeadRequestHandler.js
const supabaseService = require('../../services/supabaseService');
const stateService = require('../../services/stateService');
const logger = require('../../utils/logger');
const {
    LEAD_COLLECTION_START_MESSAGE,
    LEAD_PROMPT_NAME,
    USER_STATE_AWAITING_LEAD_NAME,
    GENERAL_ERROR_MESSAGE,
    LEAD_ALREADY_SUBMITTED_IN_DIALOGUE,
    LEAD_ALREADY_IN_PROGRESS,
    MAIN_MENU_LEAD_REQUEST, // Для сохранения команды
} = require('../../constants');
const { getUserLogInfo, saveUserCommand, mainKeyboard } = require('../telegramUtils');

async function handleDirectLeadRequest(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    logger.log(`[Cmd][DirectLead] Пользователь нажал "${MAIN_MENU_LEAD_REQUEST}" ${getUserLogInfo(msg)}`);
    await saveUserCommand(chatId, userId, MAIN_MENU_LEAD_REQUEST);

    const sessionState = stateService.getSessionState(userId);

    // Проверка, не находится ли пользователь уже в процессе сбора лида
    if (sessionState && sessionState.lead_id && sessionState.current_state) {
        logger.info(`[Cmd][DirectLead] UserID: ${userId} уже в процессе сбора лида (state: ${sessionState.current_state}). Сообщаем.`);
        await bot.sendMessage(chatId, LEAD_ALREADY_IN_PROGRESS, mainKeyboard);
        return;
    }
    
    // Проверка, не был ли уже собран лид в текущем диалоге
    const currentDialogueId = await supabaseService.getActiveDialogueId(chatId, userId);
    if (currentDialogueId) {
        const existingLead = await supabaseService.findCollectedLeadByDialogueId(currentDialogueId);
        if (existingLead) {
            logger.info(`[Cmd][DirectLead] Лид уже собран для UserID: ${userId} в DialogueID: ${currentDialogueId}. LeadID: ${existingLead.id}`);
            await bot.sendMessage(chatId, LEAD_ALREADY_SUBMITTED_IN_DIALOGUE, mainKeyboard);
            return; 
        }
    }

    // Если нет активного процесса и нет ранее собранного лида в диалоге, начинаем сбор
    logger.info(`[Cmd][DirectLead] UserID: ${userId} инициирует новый сбор лида.`);
    
    try {
        const newLead = await supabaseService.createLead({
            user_id: userId,
            chat_id: chatId,
            dialogue_id: currentDialogueId, // Может быть null, если это первый контакт и диалог еще не создан
            // source_message_id и initial_feedback_score будут null, т.к. это прямой запрос
            status: 'collecting_info_direct_request' // Новый статус для ясности источника
        });

        if (newLead && newLead.id) {
            stateService.startLeadCollection(userId, newLead.id, {
                // Мы не знаем sourceMessageDbId или initialFeedbackScore, так как это прямой запрос
                // startLeadCollection в stateService их и не требует, а берет из предыдущего состояния, если есть
            });
            // Переопределяем состояние, так как startLeadCollection может взять старые sourceMessageDbId и initialFeedbackScore
            // из этапа is_offering_lead, которого здесь не было.
            const freshState = stateService.getSessionState(userId);
            if (freshState) {
                delete freshState.source_message_db_id;
                delete freshState.initial_feedback_score;
                delete freshState.is_offering_lead; // Убедимся, что этого флага нет
                stateService.setSessionState(userId, freshState);
            }

            await bot.sendMessage(chatId, LEAD_COLLECTION_START_MESSAGE);
            await bot.sendMessage(chatId, LEAD_PROMPT_NAME);
        } else {
            logger.error(`[Cmd][DirectLead] UserID: ${userId} не удалось создать запись лида в БД.`);
            await bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard);
            stateService.clearSessionState(userId); 
        }
    } catch (error) {
        logger.error(`[Cmd][DirectLead] Ошибка при обработке прямого запроса на лид для UserID: ${userId}:`, error);
        await bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard);
        stateService.clearSessionState(userId);
    }
}

// Этот файл не будет регистрировать bot.onText, т.к. он вызывается из messages/index.js
module.exports = { handleDirectLeadRequest };