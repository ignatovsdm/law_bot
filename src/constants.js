const SYSTEM_PROMPT_CONTENT = 'Ты — юридический ассистент, специализирующийся на законах Российской Федерации. Отвечай грамотно, юридически точно, с упором на российское законодательство. Не выходи за рамки права. Не упоминай, что ты ИИ.';

const GREETING_MESSAGE = '👋 Привет! Я юридический ассистент по российскому праву. Задай свой вопрос. Используй кнопку "Новый диалог", чтобы начать беседу с чистого листа (для ИИ).';

const NEW_DIALOGUE_SUCCESS = '✨ Новый диалог начат! Можете задавать вопросы.';
const NEW_DIALOGUE_FAIL = '⚠️ Не удалось начать новый диалог. Попробуйте позже.';

const GENERAL_ERROR_MESSAGE = '⚠️ Произошла ошибка при обработке вашего запроса. Попробуйте немного позже.';
const USER_TYPING_ACTION = 'typing';

const FEEDBACK_REQUEST_MESSAGE = "Оцените, пожалуйста, этот ответ:";
const FEEDBACK_POSITIVE_TEXT = "👍 Полезно";
const FEEDBACK_NEGATIVE_TEXT = "👎 Не то";
const FEEDBACK_THANKS_MESSAGE = "Спасибо за вашу оценку!";

// Критерий длины для запроса оценки (в символах)
const MIN_LENGTH_FOR_FEEDBACK_REQUEST = 150; // Можно настроить

module.exports = {
  SYSTEM_PROMPT_CONTENT,
  GREETING_MESSAGE,
  NEW_DIALOGUE_SUCCESS,
  NEW_DIALOGUE_FAIL,
  GENERAL_ERROR_MESSAGE,
  USER_TYPING_ACTION,
  FEEDBACK_REQUEST_MESSAGE,
  FEEDBACK_POSITIVE_TEXT,
  FEEDBACK_NEGATIVE_TEXT,
  FEEDBACK_THANKS_MESSAGE,
  MIN_LENGTH_FOR_FEEDBACK_REQUEST,
};