require('dotenv').config();
const fs = require('fs');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const articles = JSON.parse(fs.readFileSync('gk_rf_structured_flat.json', 'utf-8')).slice(0, 20000); // ⚠️ батч 50

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 1000;

async function generateEmbedding(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return res.data[0].embedding;
}

async function processBatch(batch) {
  const entries = await Promise.all(
    batch.map(async (item) => {
      try {
        const embedding = await generateEmbedding(item.text);
        return { ...item, embedding };
      } catch (e) {
        console.error(`❌ Ошибка эмбеддинга (статья ${item.article}, пункт ${item.point}):`, e.message);
        return null;
      }
    })
  );

  const validEntries = entries.filter(Boolean);
  if (validEntries.length === 0) return;

  const { error } = await supabase.from('gk_articles').insert(validEntries);
  if (error) {
    console.error('❌ Ошибка вставки в Supabase:', error.message);
  } else {
    console.log(`✅ Успешно вставлено: ${validEntries.length} записей`);
  }
}

(async () => {
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    console.log(`🚀 Обработка батча ${i / BATCH_SIZE + 1} (${batch.length} записей)...`);
    await processBatch(batch);
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
  }
})();