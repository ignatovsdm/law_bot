// src/services/stateService.js
const logger = require('../utils/logger');

// Хранилище состояний пользователей для сбора лидов (в памяти)
// userId -> { state: "...", leadId: "...", data: {}, pendingLeadOffer?: boolean, sourceMessageDbId?: number, initialFeedbackScore?: number }
const userStates = {}; 

function getUserState(userId) {
  // logger.debug(`[StateService] Запрос состояния для UserID: ${userId}. Текущее: ${JSON.stringify(userStates[userId])}`);
  return userStates[userId];
}

function setUserState(userId, stateData) {
  logger.info(`[StateService] Установка состояния для UserID: ${userId}`, JSON.stringify(stateData));
  userStates[userId] = stateData;
}

function clearUserState(userId) {
  if (userStates[userId]) {
    logger.info(`[StateService] Очистка состояния для UserID: ${userId}`);
    delete userStates[userId];
    return true;
  }
  return false;
}

// Можно добавить и другие функции, например, для обновления части состояния

module.exports = {
  getUserState,
  setUserState,
  clearUserState,
  // Если нужен прямой доступ к объекту (менее предпочтительно, но для совместимости с текущим кодом handlers.js):
  // userStates, // Раскомментировать, если handlers.js будет напрямую менять userStates[userId].data
};