require('dotenv').config();
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return res.data[0].embedding;
}

async function semanticSearch(query) {
  const embedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc('match_gk_articles', {
    query_embedding: embedding,
    match_threshold: 0.78, // можно подправить
    match_count: 5
  });

  if (error) throw error;
  return data;
}

(async () => {
  const query = 'Как заключить договор между двумя компаниями?';
  const results = await semanticSearch(query);

  console.log(`🔍 Результаты для запроса: "${query}"`);
  results.forEach((item, i) => {
    console.log(`\n${i + 1}. [ст. ${item.article} п. ${item.point}] ${item.article_title}`);
    console.log(`→ ${item.text}`);
  });
})();