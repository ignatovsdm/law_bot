const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

/**
 * Находит ID активного диалога для пользователя в чате.
 * Если активного диалога нет, создает новый и возвращает его ID.
 * @param {number} chatId - ID чата Telegram.
 * @param {number} userId - ID пользователя Telegram.
 * @returns {Promise<string|null>} UUID активного диалога или null в случае ошибки.
 */
async function getActiveDialogueId(chatId, userId) {
  logger.info(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Поиск активного диалога...`);
  
  let { data: activeDialogues, error: findError } = await supabase
    .from('dialogues')
    .select('id')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false }) 
    .limit(1);

  if (findError) {
    logger.error(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Ошибка при поиске активного диалога:`, findError);
    return null;
  }

  if (activeDialogues && activeDialogues.length > 0) {
    logger.info(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Найден активный диалог: ${activeDialogues[0].id}`);
    return activeDialogues[0].id;
  }

  logger.info(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Активный диалог не найден, создаем новый...`);
  return createNewDialogue(chatId, userId);
}

/**
 * Создает новый диалог для пользователя, деактивируя все предыдущие активные диалоги этого пользователя в этом чате.
 * @param {number} chatId - ID чата Telegram.
 * @param {number} userId - ID пользователя Telegram.
 * @returns {Promise<string|null>} UUID нового диалога или null в случае ошибки.
 */
async function createNewDialogue(chatId, userId) {
  logger.info(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Создание нового диалога...`);
  try {
    const { error: updateError } = await supabase
      .from('dialogues')
      .update({ is_active: false, last_message_at: new Date().toISOString() }) 
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (updateError) {
      logger.error(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Ошибка при деактивации старых диалогов:`, updateError);
    }

    const { data: newDialogue, error: insertError } = await supabase
      .from('dialogues')
      .insert([{ chat_id: chatId, user_id: userId, is_active: true }])
      .select('id')
      .single(); 

    if (insertError) {
      logger.error(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Ошибка при создании нового диалога:`, insertError);
      return null;
    }

    if (!newDialogue) {
        logger.error(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Новый диалог не был создан (нет данных после insert).`);
        return null;
    }

    logger.info(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Новый диалог создан: ${newDialogue.id}`);
    return newDialogue.id;
  } catch (error) {
    logger.error(`[SupabaseSvc][ChatID: ${chatId}, UserID: ${userId}] Исключение при создании нового диалога:`, error);
    return null;
  }
}

/**
 * Загружает историю сообщений для конкретного диалога, предназначенную для LLM.
 * (т.е. только 'user' и 'assistant' роли).
 * @param {string} dialogueId - UUID диалога.
 * @returns {Promise<Array<{role: string, content: string}>>} Массив сообщений.
 */
async function getDialogueMessagesForLLM(dialogueId) {
  if (!dialogueId) {
    logger.warn(`[SupabaseSvc] Попытка загрузить сообщения для LLM для null/undefined dialogueId.`);
    return [];
  }
  logger.info(`[SupabaseSvc][DialogueID: ${dialogueId}] Загрузка сообщений диалога для LLM...`);
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('dialogue_id', dialogueId)
    .in('role', ['user', 'assistant']) 
    .order('created_at', { ascending: true });

  if (error) {
    logger.error(`[SupabaseSvc][DialogueID: ${dialogueId}] Ошибка загрузки сообщений для LLM:`, error);
    return []; 
  }
  const messages = data || [];
  logger.info(`[SupabaseSvc][DialogueID: ${dialogueId}] Сообщения для LLM загружены. Сообщений: ${messages.length}.`);
  return messages;
}

/**
 * Загружает ВСЕ сообщения для конкретного диалога, включая команды.
 * @param {string} dialogueId - UUID диалога.
 * @returns {Promise<Array<{id: number|string, role: string, content: string, created_at: string, feedback_score: number|null }>>} Массив сообщений.
 */
async function getAllDialogueMessages(dialogueId) {
    if (!dialogueId) {
      logger.warn(`[SupabaseSvc] Попытка загрузить все сообщения для null/undefined dialogueId.`);
      return [];
    }
    logger.info(`[SupabaseSvc][DialogueID: ${dialogueId}] Загрузка ВСЕХ сообщений диалога...`);
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at, feedback_score')  // Добавили id и feedback_score
      .eq('dialogue_id', dialogueId)
      .order('created_at', { ascending: true });
  
    if (error) {
      logger.error(`[SupabaseSvc][DialogueID: ${dialogueId}] Ошибка загрузки ВСЕХ сообщений:`, error);
      return [];
    }
    const messages = data || [];
    logger.info(`[SupabaseSvc][DialogueID: ${dialogueId}] ВСЕ сообщения диалога загружены. Сообщений: ${messages.length}.`);
    return messages;
  }

/**
 * Сохраняет сообщение в указанный диалог и обновляет last_message_at у диалога.
 * @param {string} dialogueId - UUID диалога.
 * @param {string} role - Роль ('system', 'user', 'assistant', 'user_command').
 * @param {string} content - Содержимое сообщения.
 * @returns {Promise<{id: number|string}|null>} Объект с ID сохраненного сообщения или null.
 */
async function saveMessage(dialogueId, role, content) {
  if (!dialogueId) {
    logger.error(`[SupabaseSvc] Попытка сохранить сообщение для null/undefined dialogueId.`);
    throw new Error('Supabase: dialogueId is required to save a message.');
  }
  const logContentPreview = content.length > 70 ? `"${content.substring(0, 70)}..."` : `"${content}"`;
  const logContent = (role === 'user' || role === 'user_command' || content.length < 100) ? logContentPreview : `(ответ ассистента, длина: ${content.length})`;
  logger.info(`[SupabaseSvc][DialogueID: ${dialogueId}] Попытка сохранения сообщения (роль: ${role}, контент: ${logContent})...`);
  
  const now = new Date().toISOString();

  try {
    const { data: insertedMessage, error: messageError } = await supabase
      .from('messages')
      .insert([{ dialogue_id: dialogueId, role, content, created_at: now }])
      .select('id') // Запрашиваем ID
      .single();    // Ожидаем один результат

    if (messageError) {
      logger.error(`[SupabaseSvc][DialogueID: ${dialogueId}] Ошибка сохранения сообщения (роль: ${role}):`, messageError);
      throw new Error(`Supabase: Failed to save message for role ${role}.`);
    }
     if (!insertedMessage || !insertedMessage.id) { // Проверяем, что ID получен
      logger.error(`[SupabaseSvc][DialogueID: ${dialogueId}] Сообщение (роль: ${role}) не было вставлено или ID не получен.`);
      throw new Error(`Supabase: Failed to save message or retrieve its ID.`);
    }

    const { error: dialogueUpdateError } = await supabase
      .from('dialogues')
      .update({ last_message_at: now })
      .eq('id', dialogueId);

    if (dialogueUpdateError) {
      logger.warn(`[SupabaseSvc][DialogueID: ${dialogueId}] Ошибка обновления last_message_at у диалога:`, dialogueUpdateError);
    }
    
    logger.info(`[SupabaseSvc][DialogueID: ${dialogueId}] Сообщение (роль: ${role}, DB_MsgID: ${insertedMessage.id}) успешно сохранено. Dialogue last_message_at обновлен.`);
    return { id: insertedMessage.id }; // Возвращаем объект с ID
  } catch (error) {
    logger.error(`[SupabaseSvc][DialogueID: ${dialogueId}] Исключение при сохранении сообщения и обновлении диалога:`, error);
    throw error; 
  }
}

/**
 * Обновляет оценку (feedback_score) для конкретного сообщения ассистента.
 * @param {number|string} messageId - ID сообщения ассистента в таблице 'messages'.
 * @param {number} score - Оценка (1 для позитивной, -1 для негативной).
 * @returns {Promise<boolean>} true в случае успеха, false в случае ошибки.
 */
async function updateMessageFeedback(messageId, score) {
  if (!messageId) {
    logger.error(`[SupabaseSvc] Попытка обновить оценку для null/undefined messageId.`);
    return false;
  }
  logger.info(`[SupabaseSvc][MessageID: ${messageId}] Обновление оценки на: ${score}`);
  
  const { error } = await supabase // Убрал data, т.к. без .select() он не информативен для update
    .from('messages')
    .update({ feedback_score: score })
    .eq('id', messageId)
    .eq('role', 'assistant'); 

  if (error) {
    logger.error(`[SupabaseSvc][MessageID: ${messageId}] Ошибка при обновлении оценки:`, error);
    return false;
  }
  
  logger.info(`[SupabaseSvc][MessageID: ${messageId}] Оценка успешно обновлена.`);
  return true;
}


module.exports = {
  getActiveDialogueId,
  createNewDialogue,
  getDialogueMessagesForLLM,
  getAllDialogueMessages,
  saveMessage,
  updateMessageFeedback,
};