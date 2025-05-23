const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

async function askOpenRouter(messages, chatId) {
  logger.info(`[OpenRouterSvc][ChatID: ${chatId}] Запрос к модели ${config.openRouterModel}. Контекст: ${messages.length} сообщ.`);
  logger.debug(`[OpenRouterSvc][ChatID: ${chatId}] Сообщения для LLM:`, JSON.stringify(messages.map(m => ({role:m.role, len:m.content.length}))));
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: config.openRouterModel,
        messages,
        // stream: false, // можно добавить другие параметры API, если нужно
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.httpReferer,
          'X-Title': config.xTitle,
        },
        timeout: 60000, // Таймаут на запрос, например 60 секунд
      }
    );

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        logger.error(`[OpenRouterSvc][ChatID: ${chatId}] Ответ API не содержит choices или choices пуст.`, response.data);
        throw new Error('OpenRouter API: Invalid response structure.');
    }
    
    const assistantReply = response.data.choices[0].message.content;
    if (typeof assistantReply !== 'string') {
        logger.error(`[OpenRouterSvc][ChatID: ${chatId}] Ответ API не содержит текстового контента.`, response.data.choices[0].message);
        throw new Error('OpenRouter API: Reply content is not a string.');
    }

    logger.info(`[OpenRouterSvc][ChatID: ${chatId}] Ответ от модели ${config.openRouterModel} получен (длина: ${assistantReply.length}).`);
    return assistantReply;
  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`[OpenRouterSvc][ChatID: ${chatId}] Ошибка запроса: ${errorMessage}`, error);
    if (error.response && error.response.status === 401) {
      logger.error(`[OpenRouterSvc][ChatID: ${chatId}] Ошибка 401 Unauthorized. Проверьте ваш OPENROUTER_API_KEY.`);
    }
    throw new Error(`OpenRouter API request failed: ${error.message}`); // Пробрасываем ошибку
  }
}

module.exports = {
  askOpenRouter,
};