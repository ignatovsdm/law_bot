const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://base.garant.ru/10164072/';
const LIMIT = 2000;

(async () => {
  console.log('🚀 Запуск браузера...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  console.log('🌐 Переход на страницу:', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 0 });

  console.log('🖱 Кликаем по всем "Развернуть"...');
  await page.evaluate(() => {
    document.querySelectorAll('img[title="Развернуть"]').forEach(btn => btn.click());
  });

  console.log('⏳ Ждём загрузку DOM (3 секунды)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const html = await page.content();
  fs.writeFileSync('debug.html', html, 'utf-8');

  console.log('🔍 Сбор статей...');
  const articles = await page.evaluate((BASE_URL, LIMIT) => {
    const result = [];
    const nodes = document.querySelectorAll('li.no_img.statya');
    for (let i = 0; i < nodes.length && result.length < LIMIT; i++) {
      const a = nodes[i].querySelector('a');
      const hTag = a?.querySelector('h6,h5,h4,h3,h2');
      const title = hTag?.innerText?.trim();
      const href = a?.getAttribute('href');

      if (title && href) {
        result.push({
          title,
          url: 'https://base.garant.ru' + href
        });
      }
    }
    return result;
  }, BASE_URL, LIMIT);

  console.log(`✅ Найдено статей: ${articles.length}`);
  fs.writeFileSync('articles.json', JSON.stringify(articles, null, 2), 'utf-8');
  console.log('💾 Сохранено в articles.json');

  await browser.close();
})();