require('dotenv').config();
const fs = require('fs');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Шаг 1. Получить эмбеддинг запроса
async function getEmbedding(query) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });
  return res.data[0].embedding;
}

// Шаг 2. Найти релевантные статьи в Supabase
async function searchArticles(queryEmbedding) {
  const { data, error } = await supabase.rpc('match_gk_articles', {
    query_embedding: queryEmbedding,
    match_threshold: 0.78,
    match_count: 10
  });

  if (error) throw new Error(error.message);
  return data;
}

// Шаг 3. Сформировать промпт


function buildPrompt(query, context) {
  const contextText = context.map(c => `Статья ${c.article}: ${c.text}`).join('\n\n');

  return `
Ты -опытный юрист с 20-летним стажем работы  в гражданском праве. Дай мне профессиональную консультацию по вопросу: [суть юридической проблемы/ситуации]. Юрисдикция: [Россия].
Проведи многоуровней юридический анализ (в приоритете  актуальные изменения в гражданском праве за последний год):
1) квалификация ситуации с точки зрения действующего законодательства;
2) анализ возможных правовых рисков и последствий.
3) обзор релевантной судебной практики и прецендентов;
4) перечень доступных правовых механизмов защиты;
5) пошаговая инструкция действий с указанием сроков, документов и потенциальных затрат.

Используй следующие источники информации для консультации: [] (перечислены в доке приоритет сверху вниз). Если вопрос не касается гражданского право - то, оповещаем клиента: "К сожалению, на данный момент я консультирую только по гражданско-правовым вопросам, но в ближайшее время будет обновление и, я надеюсь, смогу вам помочь!"
Текст должен быть написан понятным языком, использую юридические термины, но с пояснением. Текст должен быть не больше 5000 символов. Обязательно в тексте отображать статью/закон в рамках которого вопрос решается.
 Если вопрос касается судебного дела, то найди аналогичные дела по [тип дела] и проанализируй, какие [результаты аналогичных дел] были получены.
Подготовь рекомендации для клиента по [правовая проблема] с учётом [потенциальные риски].
Найди и приведи примеры успешных решений по [правовая проблема].
Какие основные шаги должен предпринять клиент в ситуации [правовая проблема]?
Помоги объяснить сложные юридические термины клиенту на примере



Контекст:
${contextText}

Вопрос:
${query}

Ответ:
`;
}

// Шаг 4. Ответить на вопрос
async function askLawyerAgent(query) {
  const embedding = await getEmbedding(query);
  const articles = await searchArticles(embedding);
  const prompt = buildPrompt(query, articles);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2
  });

  return completion.choices[0].message.content;
}

// Запуск
(async () => {
  const query = 'Как вернуть деньги за некачественный товар?';
  console.log('\nЗапрос пользователя:\n');
  console.log(query);
  const answer = await askLawyerAgent(query);
  console.log('\n🧑‍⚖️ Ответ юриста:\n');
  console.log(answer);
})();