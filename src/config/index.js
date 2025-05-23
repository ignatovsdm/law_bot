require('dotenv').config();

const config = {
  telegramToken: process.env.TELEGRAM_TOKEN,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  httpReferer: process.env.HTTP_REFERER || 'https://your-app-name.com',
  xTitle: process.env.X_TITLE || 'LegalBotTelegram',
  logLevel: process.env.LOG_LEVEL || 'info',
};

const requiredConfigKeys = ['telegramToken', 'openRouterApiKey', 'supabaseUrl', 'supabaseAnonKey'];
for (const key of requiredConfigKeys) {
  if (!config[key]) {
    // Используем console.error здесь, так как логгер может быть еще не инициализирован
    console.error(`КРИТИЧЕСКАЯ ОШИБКА: Переменная окружения для "${key}" не задана! Проверьте .env файл.`);
    process.exit(1);
  }
}

module.exports = config;