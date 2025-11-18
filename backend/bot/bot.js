const { Telegraf } = require('telegraf');

// Бот запускается только если есть токен
if (!process.env.BOT_TOKEN) {
  console.log('🤖 No BOT_TOKEN provided, running in API-only mode');
  module.exports = null;
} else {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.start((ctx) => {
    ctx.reply('🎰 Добро пожаловать в Счастливый Номер!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Начать играть', web_app: { url: process.env.WEB_APP_URL || 'https://your-lottery-app.netlify.app' } }],
          [{ text: '📊 Мой профиль', callback_data: 'profile' }],
          [{ text: 'ℹ️ Правила', callback_data: 'rules' }]
        ]
      }
    });
  });

  bot.action('profile', async (ctx) => {
    ctx.reply(`👤 Ваш профиль:\n\n` +
      `Для просмотра статистики откройте мини-приложение! 🎰\n\n` +
      `Нажмите "🎮 Начать играть" чтобы увидеть ваш профиль и баланс.`);
  });

  bot.action('rules', (ctx) => {
    ctx.reply(`🎯 Правила игры:\n\n` +
      `1. Каждый игрок получает номер от 1 до 10\n` +
      `2. Когда набирается 10 игроков - игра начинается\n` +
      `3. Рулетка определяет 3 выигрышных номера\n` +
      `4. Призы: 50% банка + два по 25%\n` +
      `5. Взнос за игру: 10 ⭐\n\n` +
      `Удачи! 🍀`);
  });

  bot.launch().then(() => {
    console.log('🤖 Telegram bot started successfully');
  }).catch(error => {
    console.error('❌ Telegram bot failed to start:', error.message);
  });

  module.exports = bot;
}
