// src/constants.js
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

const MIN_LENGTH_FOR_FEEDBACK_REQUEST = 150;

const LEAD_PROMPT_POSITIVE_FEEDBACK = "Спасибо за высокую оценку! 😊 Хотите ли вы оставить заявку на общение с живым юристом?";
const LEAD_PROMPT_NEGATIVE_FEEDBACK = "Очень жаль, что ответ вас не устроил. 😔 Возможно, живой специалист сможет вам помочь лучше. Желаете оставить заявку на консультацию?";
const LEAD_CONFIRM_YES = "Да, хочу";
const LEAD_CONFIRM_NO = "Нет, спасибо";

const LEAD_COLLECTION_START_MESSAGE = "Отлично! Чтобы мы могли связаться с вами, пожалуйста, ответьте на несколько вопросов.";
const LEAD_PROMPT_NAME = "1. Введите Ваше имя:";
const LEAD_PROMPT_PHONE = "2. Введите Ваш номер телефона (например, +79XXXXXXXXX):";
const LEAD_PROMPT_EMAIL = "3. Введите Ваш email (например, user@example.com):";
const LEAD_PROMPT_CONTACT_METHOD = "4. Выберите предпочтительный способ связи:";
const LEAD_CONTACT_METHOD_TELEGRAM = "Telegram";
const LEAD_CONTACT_METHOD_WHATSAPP = "WhatsApp";
const LEAD_CONTACT_METHOD_EMAIL = "Email";
const LEAD_CONTACT_METHOD_CALL = "Телефонный звонок";
const LEAD_SUBMITTED_MESSAGE = "Спасибо! Ваша заявка №%LEAD_ID% получена. Специалист свяжется с вами в ближайшее время."; // %LEAD_ID% будет заменен
const LEAD_CANCELLED_MESSAGE = "Понимаю. Если передумаете, вы всегда можете попросить о связи с юристом.";

const CALLBACK_DATA_LEAD_YES = "lead_confirm_yes";
const CALLBACK_DATA_LEAD_NO = "lead_confirm_no";
const CALLBACK_DATA_CONTACT_TELEGRAM = "lead_contact_tg";
const CALLBACK_DATA_CONTACT_WHATSAPP = "lead_contact_wa";
const CALLBACK_DATA_CONTACT_EMAIL = "lead_contact_email";
const CALLBACK_DATA_CONTACT_CALL = "lead_contact_call";

const USER_STATE_AWAITING_LEAD_NAME = "awaiting_lead_name";
const USER_STATE_AWAITING_LEAD_PHONE = "awaiting_lead_phone";
const USER_STATE_AWAITING_LEAD_EMAIL = "awaiting_lead_email";
const USER_STATE_AWAITING_LEAD_CONTACT_METHOD = "awaiting_lead_contact_method";

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
  LEAD_PROMPT_POSITIVE_FEEDBACK,
  LEAD_PROMPT_NEGATIVE_FEEDBACK,
  LEAD_CONFIRM_YES,
  LEAD_CONFIRM_NO,
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
};