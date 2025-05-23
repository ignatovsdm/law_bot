const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const INPUT_FILE = 'articles.json';
const OUTPUT_FILE = 'content.json';
const LIMIT = 15; // можно увеличить до 1000+
const CONCURRENCY = 5; // сколько вкладок одновременно

(async () => {
  const articles = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8')).slice(0, LIMIT);
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const scrapeArticle = async ({ title, url }, index) => {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    );

    console.log(`➡️ [${index + 1}] ${title}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const html = await page.$eval('section.content', el => el.innerHTML);
      await page.close();
      return { title, url, html };
    } catch (err) {
      console.error(`❌ [${index + 1}] Ошибка: ${url} — ${err.message}`);
      await page.close();
      return null;
    }
  };

  const results = [];

  for (let i = 0; i < articles.length; i += CONCURRENCY) {
    const batch = articles.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((item, idx) => scrapeArticle(item, i + idx)));
    results.push(...batchResults.filter(Boolean));
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`💾 Сохранено ${results.length} статей в ${OUTPUT_FILE}`);
})();