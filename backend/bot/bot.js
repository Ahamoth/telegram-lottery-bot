// backend/bot/bot.js
const { Telegraf } = require('telegraf');

module.exports = (pool) => {
  if (!process.env.BOT_TOKEN) {
    console.log('No BOT_TOKEN – bot не запускается');
    return null;
  }

  const bot = new Telegraf(process.env.BOT_TOKEN);

  // ==================== КОМАНДЫ И КНОПКИ ====================
  bot.start((ctx) => {
    ctx.reply('Добро пожаловать в Счастливый Номер! 🎰', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Начать играть', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }],
          [{ text: 'Мой баланс', callback_data: 'balance' }],
          [{ text: 'Профиль', callback_data: 'profile' }],
          [{ text: 'Правила', callback_data: 'rules' }]
        ]
      }
    });
  });

  bot.command('balance', (ctx) => ctx.reply('Открывайте приложение, чтобы увидеть баланс и пополнить его ⭐', {
    reply_markup: { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]] }
  }));

  bot.action('balance', (ctx) => { ctx.answerCbQuery(); ctx.reply('Баланс и пополнение — в приложении!', { reply_markup: { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]] }}); });
  bot.action('profile', (ctx) => { ctx.answerCbQuery(); ctx.reply('Весь профиль — в приложении!', { reply_markup: { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]] }}); });
  bot.action('rules', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(`Правила игры:\n\n` +
      `• Взнос 10 ⭐\n` +
      `• Нужны минимум 2 реальных игрока\n` +
      `• Выигрывают 3 номера: 50% + 25% + 25%\n\n` +
      `Удачи! 🍀`, {
      reply_markup: { inline_keyboard: [[{ text: 'Играть', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]] }
    });
  });

  // ==================== STARS ПЛАТЕЖИ ====================
  bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

  bot.on('successful_payment', async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;
    const amount = ctx.message.successful_payment.total_amount;
    const telegramId = ctx.from.id.toString();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        'SELECT * FROM transactions WHERE invoice_payload = $1 AND status = $2',
        [payload, 'pending']
      );

      if (res.rows.length === 0) {
        await client.query('ROLLBACK');
        return ctx.reply('Платёж не найден');
      }

      const transaction = res.rows[0];

      await client.query(
        `UPDATE transactions SET
           status = 'completed',
           telegram_payment_charge_id = $1,
           provider_payment_charge_id = $2,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [
          ctx.message.successful_payment.telegram_payment_charge_id,
          ctx.message.successful_payment.provider_payment_charge_id,
          transaction.id
        ]
      );

      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      await client.query('COMMIT');
      await ctx.reply(`+${amount} ⭐ успешно зачислено!\nБаланс обновится в приложении через секунду ✅`);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Stars payment error:', err);
      await ctx.reply('Ошибка зачисления');
    } finally {
      client.release();
    }
  });

  // ==================== ЗАПУСК БОТА ====================
  bot.launch({
    dropPendingUpdates: true   // ← навсегда решает 409 ошибку на Render
  }).then(() => {
    console.log('Telegram bot запущен успешно');
  }).catch(err => {
    console.error('Не удалось запустить бота:', err.message);
  });

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
};
