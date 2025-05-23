require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.OPENROUTER_API_KEY;

// История сообщений сохраняется тут:
const messages = [
  { role: 'user', content: 'Объясни квантовую физику простыми словами' }
];

async function sendPrompt(newPrompt) {
  // Добавляем новый запрос в историю
  messages.push({ role: 'user', content: newPrompt });

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4', // или другая модель с поддержкой диалога
        messages: messages
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://yourdomain.com',
          'X-Title': 'MyNodeChatApp'
        }
      }
    );

    const reply = response.data.choices[0].message.content;
    console.log('🤖 Ответ:\n', reply);

    // Добавляем ответ в историю, чтобы сохранить контекст
    messages.push({ role: 'assistant', content: reply });
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

// Пример: серия вопросов
(async () => {
  await sendPrompt('Объясни квантовую физику простыми словами');
  await sendPrompt('А как она применяется в реальной жизни?');
  await sendPrompt('Можешь привести пример?');
})();