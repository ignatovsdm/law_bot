// src/services/supabaseService.js
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

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

async function getAllDialogueMessages(dialogueId) {
    if (!dialogueId) {
      logger.warn(`[SupabaseSvc] Попытка загрузить все сообщения для null/undefined dialogueId.`);
      return [];
    }
    logger.info(`[SupabaseSvc][DialogueID: ${dialogueId}] Загрузка ВСЕХ сообщений диалога...`);
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at, feedback_score') 
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
      .select('id') 
      .single();    

    if (messageError) {
      logger.error(`[SupabaseSvc][DialogueID: ${dialogueId}] Ошибка сохранения сообщения (роль: ${role}):`, messageError);
      throw new Error(`Supabase: Failed to save message for role ${role}.`);
    }
     if (!insertedMessage || !insertedMessage.id) { 
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
    return { id: insertedMessage.id }; 
  } catch (error) {
    logger.error(`[SupabaseSvc][DialogueID: ${dialogueId}] Исключение при сохранении сообщения и обновлении диалога:`, error);
    throw error; 
  }
}

async function updateMessageFeedback(messageId, score) {
  if (!messageId) {
    logger.error(`[SupabaseSvc] Попытка обновить оценку для null/undefined messageId.`);
    return false;
  }
  logger.info(`[SupabaseSvc][MessageID: ${messageId}] Обновление оценки на: ${score}`);
  
  const { error } = await supabase
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

async function createLead(leadData) {
  logger.info(`[SupabaseSvc] Создание нового лида для UserID: ${leadData.userId}...`, JSON.stringify(leadData, null, 2)); // Улучшенное логирование
  const { data, error } = await supabase
    .from('leads')
    .insert([leadData])
    .select('id')
    .single();

  if (error) {
    logger.error(`[SupabaseSvc] Ошибка при создании лида:`, error);
    return null;
  }
  if (!data || !data.id) {
    logger.error(`[SupabaseSvc] Лид не был создан или ID не был возвращен.`);
    return null;
  }
  logger.info(`[SupabaseSvc] Лид успешно создан. LeadID: ${data.id}`);
  return data; 
}

async function updateLead(leadId, updateData) {
  logger.info(`[SupabaseSvc] Обновление лида LeadID: ${leadId}...`, JSON.stringify(updateData, null, 2)); // Улучшенное логирование
  const { error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId);

  if (error) {
    logger.error(`[SupabaseSvc] Ошибка при обновлении лида LeadID: ${leadId}:`, error);
    return false;
  }
  logger.info(`[SupabaseSvc] Лид LeadID: ${leadId} успешно обновлен.`);
  return true;
}

module.exports = {
  getActiveDialogueId,
  createNewDialogue,
  getDialogueMessagesForLLM,
  getAllDialogueMessages,
  saveMessage,
  updateMessageFeedback,
  createLead,
  updateLead,
};