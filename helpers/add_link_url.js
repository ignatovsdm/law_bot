const fs = require("fs");

const structuredFile = "gk_rf_structured_flat.json";
const articlesFile = "articles.json";
const outputFile = "gk_rf_structured_with_urls.json";

const structured = JSON.parse(fs.readFileSync(structuredFile, "utf-8"));
const articleLinks = JSON.parse(fs.readFileSync(articlesFile, "utf-8"));

// Фиксированная ссылка для статей 66–106.6
const specialUrl = "https://base.garant.ru/10164072/1805075a36baa8b06408db4742299d05/";

// Мапа "Номер статьи|Заголовок" → URL
const urlMap = {};
for (const item of articleLinks) {
  const match = item.title.match(/^Статья\s+(\d+)[.:]?\s+(.+)/);
  if (match) {
    const article = match[1];
    const title = match[2].trim();
    const key = `${article}|${title}`;
    urlMap[key] = item.url;
  }
}

let matched = 0;
let forced = 0;
let unmatched = 0;

for (const entry of structured) {
  const artNum = entry.article;
  const artNumNumeric = parseFloat(artNum.replace(",", "."));

  // Условие: статья между 66 и 106.6 (включительно)
  const isSpecial = artNumNumeric >= 66 && artNumNumeric <= 106.6;

  if (isSpecial) {
    entry.url = specialUrl;
    forced++;
  } else {
    const key = `${entry.article}|${entry.article_title}`;
    if (urlMap[key]) {
      entry.url = urlMap[key];
      matched++;
    } else {
      entry.url = null;
      unmatched++;
    }
  }
}

fs.writeFileSync(outputFile, JSON.stringify(structured, null, 2), "utf-8");

console.log(`✅ Совпадений по title+номер: ${matched}`);
console.log(`🔧 Применено спец-URL (66–106.6): ${forced}`);
console.log(`⚠️ Не найдено URL: ${unmatched}`);
console.log(`💾 Сохранено в ${outputFile}`);