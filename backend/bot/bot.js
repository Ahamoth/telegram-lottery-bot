const { Telegraf } = require('telegraf');
module.exports = (pool) => {
  const bot = new Telegraf(process.env.BOT_TOKEN);
// Бот запускается только если есть токен
if (!process.env.BOT_TOKEN) {
  console.log('🤖 No BOT_TOKEN provided, running in API-only mode');
  module.exports = null;
} else {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  // Обработка команды /start
  bot.start((ctx) => {
    console.log('🚀 /start command received from:', ctx.from.id);
    
    ctx.reply('🎰 Добро пожаловать в Счастливый Номер!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Начать играть', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }],
          [{ text: '📊 Мой профиль', callback_data: 'profile' }],
          [{ text: '💰 Мой баланс', callback_data: 'balance' }],
          [{ text: 'ℹ️ Правила', callback_data: 'rules' }]
        ]
      }
    });
  });

  // Обработка команды /balance
  bot.command('balance', (ctx) => {
    console.log('💰 /balance command received from:', ctx.from.id);
    
    ctx.reply(`💰 Ваш баланс:\n\n` +
      `Для просмотра баланса и пополнения откройте мини-приложение! 🎰\n\n` +
      `Нажмите "🎮 Начать играть" чтобы увидеть ваш баланс и статистику.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }],
          [{ text: '💫 Пополнить баланс', callback_data: 'topup' }]
        ]
      }
    });
  });

  // Обработка команды /profile
  bot.command('profile', (ctx) => {
    console.log('👤 /profile command received from:', ctx.from.id);
    
    ctx.reply(`👤 Ваш профиль:\n\n` +
      `Для просмотра статистики и истории игр откройте мини-приложение! 🎰\n\n` +
      `Нажмите "🎮 Начать играть" чтобы увидеть ваш профиль.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
        ]
      }
    });
  });

  // Обработка команды /help
  bot.command('help', (ctx) => {
    ctx.reply(`🎮 Доступные команды:\n\n` +
      `/start - Начать работу с ботом\n` +
      `/balance - Проверить баланс\n` +
      `/profile - Посмотреть профиль\n` +
      `/help - Показать справку\n\n` +
      `Или используйте кнопки ниже:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Начать играть', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }],
          [{ text: 'ℹ️ Правила', callback_data: 'rules' }]
        ]
      }
    });
  });

  // Обработка inline кнопок
  bot.action('profile', async (ctx) => {
    console.log('👤 Profile button clicked by:', ctx.from.id);
    
    await ctx.answerCbQuery();
    ctx.reply(`👤 Ваш профиль:\n\n` +
      `Для просмотра статистики откройте мини-приложение! 🎰\n\n` +
      `Нажмите "🎮 Начать играть" чтобы увидеть ваш профиль и баланс.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
        ]
      }
    });
  });

  bot.action('balance', async (ctx) => {
    console.log('💰 Balance button clicked by:', ctx.from.id);
    
    await ctx.answerCbQuery();
    ctx.reply(`💰 Ваш баланс:\n\n` +
      `Для просмотра баланса и пополнения откройте мини-приложение! 🎰\n\n` +
      `Нажмите "🎮 Начать играть" чтобы увидеть ваш баланс.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
        ]
      }
    });
  });

  bot.action('topup', async (ctx) => {
    console.log('💫 Topup button clicked by:', ctx.from.id);
    
    await ctx.answerCbQuery();
    ctx.reply(`💫 Пополнение баланса:\n\n` +
      `Для пополнения баланса Telegram Stars откройте мини-приложение!\n\n` +
      `В разделе "Профиль" вы сможете пополнить баланс.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
        ]
      }
    });
  });

  bot.action('rules', async (ctx) => {
    console.log('ℹ️ Rules button clicked by:', ctx.from.id);
    
    await ctx.answerCbQuery();
    ctx.reply(`🎯 Правила игры:\n\n` +
      `1. Каждый игрок получает номер от 1 до 10\n` +
      `2. Когда набирается 2+ реальных игроков - игра начинается\n` +
      `3. Рулетка определяет 3 выигрышных номера\n` +
      `4. Призы: 50% банка + два по 25%\n` +
      `5. Взнос за игру: 10 ⭐\n\n` +
      `Удачи! 🍀`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Начать играть', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
        ]
      }
    });
  });

  // Обработка текстовых сообщений
  bot.on('text', (ctx) => {
    console.log('📝 Text message received:', ctx.message.text);
    
    const text = ctx.message.text.toLowerCase();
    
    if (text.includes('баланс') || text.includes('balance')) {
      ctx.reply(`💰 Информация о балансе:\n\nОткройте мини-приложение для просмотра баланса!`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
          ]
        }
      });
    } else if (text.includes('правила') || text.includes('rules')) {
      ctx.reply(`📖 Правила игры в мини-приложении!`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
          ]
        }
      });
    } else if (text.includes('игра') || text.includes('game')) {
      ctx.reply(`🎮 Начните играть прямо сейчас!`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Начать играть', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }]
          ]
        }
      });
    } else {
      ctx.reply(`🤖 Я бот для лотереи "Счастливый Номер"! 🎰\n\n` +
        `Используйте команды или кнопки для навигации:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Начать играть', web_app: { url: process.env.WEB_APP_URL || 'https://telegram-lottery-bot.netlify.app' } }],
            [{ text: '💰 Баланс', callback_data: 'balance' }, { text: '👤 Профиль', callback_data: 'profile' }],
            [{ text: 'ℹ️ Правила', callback_data: 'rules' }, { text: '💫 Пополнить', callback_data: 'topup' }]
          ]
        }
      });
    }
  });

  // Обработка ошибок
  bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    ctx.reply('❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
  });
// Обязательно отвечаем OK на pre-checkout
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

// Обработка успешного платежа
bot.on('successful_payment', async (ctx) => {
  const payload = ctx.message.successful_payment.invoice_payload; // например: stars_123
  const amount = ctx.message.successful_payment.total_amount;
  const telegramId = ctx.from.id.toString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ищем транзакцию по payload
    const transRes = await client.query(
      'SELECT * FROM transactions WHERE invoice_payload = $1 AND status = $1',
      [payload, 'pending']
    );

    if (transRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return ctx.reply('Ошибка: платёж не найден');
    }

    const transaction = transRes.rows[0];

    // Обновляем транзакцию
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

    // Пополняем баланс
    await client.query(
      'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
      [amount, telegramId]
    );

    await client.query('COMMIT');

    await ctx.reply(`Пополнено +${amount} ⭐!\nТекущий баланс: обновится в приложении через секунду ✅`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stars payment processing error:', err);
    await ctx.reply('Ошибка обработки платежа');
  } finally {
    client.release();
  }
});
  // Запуск бота с улучшенной обработкой ошибок
  bot.launch({
    dropPendingUpdates: true
  })
  .then(() => {
    console.log('🤖 Telegram bot started successfully');
    
    // Устанавливаем команды бота
    bot.telegram.setMyCommands([
      { command: 'start', description: 'Запустить бота' },
      { command: 'balance', description: 'Проверить баланс' },
      { command: 'profile', description: 'Посмотреть профиль' },
      { command: 'help', description: 'Помощь и команды' }
    ]).then(() => {
      console.log('✅ Bot commands set successfully');
    }).catch(err => {
      console.error('❌ Failed to set bot commands:', err);
    });
  })
  .catch(error => {
    console.error('❌ Telegram bot failed to start:', error.message);
  });

  // Включить graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  module.exports = bot;
}
// Обработка успешного платежа Stars — РАБОЧАЯ ВЕРСИЯ
  bot.on('successful_payment', async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;
    const amount = ctx.message.successful_payment.total_amount;
    const telegramId = ctx.from.id.toString();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ищем транзакцию по payload (уникальный, который мы генерировали)
      const transRes = await client.query(
        'SELECT * FROM transactions WHERE invoice_payload = $1 AND status = $2',
        [payload, 'pending']
      );

      if (transRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return ctx.reply('Платёж не найден');
      }

      const transaction = transRes.rows[0];

      // Обновляем транзакцию
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

      // Пополняем баланс
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      await client.query('COMMIT');

      await ctx.reply(`Пополнено +${amount} ⭐!\nБаланс обновится в приложении через секунду ✅`);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Payment processing error:', err);
      await ctx.reply('Ошибка обработки платежа');
    } finally {
      client.release();
    }
  });

  // pre_checkout — обязательно отвечаем true
  bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

  // Запуск бота
  bot.launch();
  console.log('Bot launched with pool access');

  return bot;
};

