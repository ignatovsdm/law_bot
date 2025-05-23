// src/telegram/commands/newDialogueHandler.js
const assistantLogic = require('../../core/assistantLogic'); 
const stateService = require('../../services/stateService'); 
const logger = require('../../utils/logger'); 
const { NEW_DIALOGUE_SUCCESS, NEW_DIALOGUE_FAIL, GENERAL_ERROR_MESSAGE } = require('../../constants'); 
const { mainKeyboard, getUserLogInfo, saveUserCommand } = require('../telegramUtils'); 

async function handleNewDialogueAction(bot, msg, commandText) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    logger.log(`[Cmd][NewDialogue] Команда "${commandText}" ${getUserLogInfo(msg)}`);
    
    await saveUserCommand(chatId, userId, commandText);
    stateService.clearSessionState(userId); // Используется clearSessionState - OK

    try {
        const newDialogueId = await assistantLogic.startNewUserDialogue(chatId, userId);
        if (newDialogueId) {
            await bot.sendMessage(chatId, NEW_DIALOGUE_SUCCESS, mainKeyboard);
        } else {
            await bot.sendMessage(chatId, NEW_DIALOGUE_FAIL, mainKeyboard);
        }
    } catch (error) {
        logger.error(`[Cmd][NewDialogue] Ошибка при обработке "${commandText}" ChatID: ${chatId}:`, error);
        bot.sendMessage(chatId, GENERAL_ERROR_MESSAGE, mainKeyboard)
            .catch(e => logger.error(`[Cmd][NewDialogue] КРИТ. ОШИБКА отправки сообщения ChatID: ${chatId}:`, e));
    }
}

function register(bot) {
    bot.onText(/\/new$/, async (msg) => {
        await handleNewDialogueAction(bot, msg, '/new');
    });
}

module.exports = { register, handleNewDialogueAction };