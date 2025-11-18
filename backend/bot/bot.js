const { Telegraf } = require('telegraf');
const User = require('../models/User');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Start command
bot.start((ctx) => {
  ctx.reply('🎰 Добро пожаловать в Счастливый Номер!', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Начать играть', web_app: { url: process.env.WEB_APP_URL } }],
        [{ text: '📊 Мой профиль', callback_data: 'profile' }],
        [{ text: 'ℹ️ Правила', callback_data: 'rules' }]
      ]
    }
  });
});

// Profile callback
bot.action('profile', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id.toString() });
  
  if (user) {
    const winRate = user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0;
    
    ctx.reply(`👤 Ваш профиль:\n\n` +
      `💰 Баланс: ${user.balance} ⭐\n` +
      `🎮 Сыграно игр: ${user.gamesPlayed}\n` +
      `🏆 Выиграно: ${user.gamesWon}\n` +
      `📈 Процент побед: ${winRate}%\n` +
      `💎 Общий выигрыш: ${user.totalWinnings} ⭐`);
  } else {
    ctx.reply('Пожалуйста, сначала запустите мини-приложение для регистрации.');
  }
});

// Rules callback
bot.action('rules', (ctx) => {
  ctx.reply(`🎯 Правила игры:\n\n` +
    `1. Каждый игрок получает номер от 1 до 10\n` +
    `2. Когда набирается 10 игроков - игра начинается\n` +
    `3. Рулетка определяет 3 выигрышных номера\n` +
    `4. Призы: 50% банка + два по 25%\n` +
    `5. Взнос за игру: 10 ⭐\n\n` +
    `Удачи! 🍀`);
});

// Handle messages
bot.on('message', (ctx) => {
  if (ctx.message.web_app_data) {
    // Handle data from web app
    const data = JSON.parse(ctx.message.web_app_data.data);
    console.log('Received from web app:', data);
  }
});

// Start bot
bot.launch().then(() => {
  console.log('Telegram bot started');
});

module.exports = bot;