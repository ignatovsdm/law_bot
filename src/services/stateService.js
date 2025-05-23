// src/services/stateService.js
const logger = require('../utils/logger');
const { 
    USER_STATE_AWAITING_LEAD_NAME  // Только для примера, если нужна для внутренней логики
} = require('../constants');


// Структура состояния пользователя:
// userId -> { 
//   current_state?: string, 
//   lead_id?: string,       
//   lead_data?: { name?: string, phone?: string, email?: string, preferred_contact_method?: string }, 
//   is_offering_lead?: boolean, 
//   source_message_db_id?: number, 
//   initial_feedback_score?: number 
// }
const userSessionStates = {}; 

function getSessionState(userId) {
  return userSessionStates[userId];
}

function setSessionState(userId, newStateData) {
  if (newStateData === null || typeof newStateData === 'undefined') {
    return clearSessionState(userId);
  }
  // logger.info(`[StateService] Установка сессионного состояния для UserID: ${userId}`, JSON.stringify(newStateData));
  userSessionStates[userId] = newStateData;
}

function clearSessionState(userId) {
  if (userSessionStates[userId]) {
    logger.info(`[StateService] Очистка сессионного состояния для UserID: ${userId}`);
    delete userSessionStates[userId];
    return true;
  }
  return false;
}

function startLeadOffer(userId, sourceMessageDbId, initialFeedbackScore) {
    logger.info(`[StateService] Начало предложения лида для UserID: ${userId}. SourceMsgID: ${sourceMessageDbId}, Score: ${initialFeedbackScore}`);
    setSessionState(userId, {
        is_offering_lead: true,
        source_message_db_id: sourceMessageDbId,
        initial_feedback_score: initialFeedbackScore,
        lead_data: {}, // Инициализируем lead_data здесь
    });
}

function startLeadCollection(userId, leadId) {
    const currentState = getSessionState(userId) || {}; // Получаем текущее состояние (с sourceMessageDbId и т.д.)
    logger.info(`[StateService] Начало сбора лида для UserID: ${userId}. LeadID: ${leadId}.`);
    setSessionState(userId, {
        ...currentState, // Сохраняем метаданные из этапа предложения
        is_offering_lead: false, 
        current_state: USER_STATE_AWAITING_LEAD_NAME, 
        lead_id: leadId,
        lead_data: { ...(currentState.lead_data || {}) }, // Переносим или инициализируем lead_data
    });
}

/**
 * Обновляет данные лида в состоянии и, опционально, сам этап (current_state).
 * @param {number} userId 
 * @param {{ fieldToUpdate?: string, value?: any, nextStateKey?: string }} params
 */
function updateLeadCollectionProgress(userId, { fieldToUpdate, value, nextStateKey }) {
    const currentState = getSessionState(userId);
    if (!currentState || !currentState.lead_id) {
        logger.warn(`[StateService] Попытка обновить состояние сбора лида для UserID: ${userId}, но нет активного сбора (нет lead_id).`);
        return null;
    }
    
    const newLeadData = { ...(currentState.lead_data || {}) };
    if (fieldToUpdate && typeof value !== 'undefined') { // Проверяем value !== undefined, чтобы можно было передать null/пустую строку
        newLeadData[fieldToUpdate] = value;
    }

    const finalState = {
        ...currentState,
        lead_data: newLeadData,
    };

    if (nextStateKey) {
        finalState.current_state = nextStateKey;
    }
    
    logger.info(`[StateService] Обновление прогресса сбора лида для UserID: ${userId}. NewStateKey: ${nextStateKey || 'same'}. NewLeadData: ${JSON.stringify(newLeadData)}`);
    setSessionState(userId, finalState);
    return getSessionState(userId); 
}


function getCurrentLeadData(userId) {
    const state = getSessionState(userId);
    return state ? state.lead_data : null;
}

function getCurrentLeadId(userId) {
    const state = getSessionState(userId);
    return state ? state.lead_id : null;
}

function getUserCurrentStep(userId) {
    const state = getSessionState(userId);
    return state ? state.current_state : null;
}

function isUserOfferingLead(userId) {
    const state = getSessionState(userId);
    return state ? !!state.is_offering_lead : false;
}

module.exports = {
  getSessionState,
  setSessionState,
  clearSessionState,
  startLeadOffer,
  startLeadCollection,
  // updateLeadCollectionState, // Старое имя, заменяем на более понятное
  updateLeadCollectionProgress,  // <--- НОВОЕ ИМЯ ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ
  getCurrentLeadData,
  getCurrentLeadId,
  getUserCurrentStep,
  isUserOfferingLead,
};