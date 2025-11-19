// backend/routes/payment.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

module.exports = (pool, bot) => {
  // Создание ссылки на оплату Telegram Stars
  router.post('/create-invoice-link', async (req, res) => {
    try {
      const { telegramId, amount } = req.body;

      if (!telegramId || !amount || amount < 1) {
        return res.status(400).json({ success: false, error: 'Invalid telegramId or amount' });
      }

      if (!bot) {
        console.error('Bot not loaded');
        return res.status(500).json({ success: false, error: 'Payment service not ready' });
      }

      // Генерируем уникальный payload и сразу сохраняем транзакцию
      const payload = `stars_${telegramId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

      await pool.query(
        `INSERT INTO transactions 
         (telegram_id, type, amount, status, invoice_payload) 
         VALUES ($1, 'stars_deposit', $2, 'pending', $3)`,
        [telegramId, amount, payload]
      );

      const invoiceLink = await bot.telegram.createInvoiceLink({
        title: 'Пополнение баланса',
        description: `Пополнение на ${amount} Telegram Stars`,
        payload: payload,
        provider_token: '', // обязательно пусто для Stars
        currency: 'XTR',
        prices: [{ label: `${amount} Telegram Stars`, amount: amount }],
      });

      res.json({ 
        success: true, 
        invoice_link: invoiceLink 
      });

    } catch (err) {
      console.error('Create invoice error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to create payment' });
    }
  });

  // Демо-платёж (для теста)
  router.post('/demo-payment', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { telegramId, amount } = req.body;

      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      await client.query('COMMIT');
      res.json({ success: true, newBalance: 'demo' });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false });
    } finally {
      client.release();
    }
  });

  // История платежей
  router.get('/history/:telegramId', async (req, res) => {
    try {
      const { telegramId } = req.params;
      const { limit = 20 } = req.query;

      const result = await pool.query(
        `SELECT id, type, amount, status, created_at 
         FROM transactions 
         WHERE telegram_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [telegramId, limit]
      );

      res.json({ success: true, payments: result.rows });
    } catch (err) {
      console.error('History error:', err);
      res.status(500).json({ success: false });
    }
  });

  // Вывод Stars пользователю на TON Space (Telegram Wallet)
  router.post('/withdraw-to-tonspace', async (req, res) => {
    const { telegramId, amount } = req.body;

    if (!telegramId || !amount || amount < 10) {
      return res.status(400).json({ success: false, error: 'Минимум 10 ⭐' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Проверяем баланс
      const userRes = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1 FOR UPDATE',
        [telegramId]
      );

      if (userRes.rows.length === 0 || userRes.rows[0].balance < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Недостаточно ⭐ на балансе' 
        });
      }

      // Списываем с внутреннего баланса игры
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      // Записываем транзакцию как pending
      const transactionResult = await client.query(
        `INSERT INTO transactions (telegram_id, type, amount, status) 
         VALUES ($1, 'withdraw_tonspace', $2, 'pending') 
         RETURNING id`,
        [telegramId, amount]
      );

      const transactionId = transactionResult.rows[0].id;

      // Пытаемся выполнить перевод через Telegram Bot API
      try {
        console.log(`🔄 Пытаемся перевести ${amount} Stars пользователю ${telegramId}`);
        
        // Используем прямой вызов Telegram Bot API
        const response = await axios.post(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/transferStars`,
          {
            user_id: parseInt(telegramId),
            amount: parseInt(amount)
          },
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('✅ Перевод Stars выполнен успешно:', response.data);

        // Обновляем транзакцию как completed
        await client.query(
          'UPDATE transactions SET status = $1 WHERE id = $2',
          ['completed', transactionId]
        );

        await client.query('COMMIT');

        res.json({ 
          success: true, 
          message: `${amount} ⭐ мгновенно зачислено на твой Telegram Wallet (TON Space)! ⭐`,
          transaction_id: transactionId
        });

      } catch (transferError) {
        console.error('❌ Ошибка перевода Stars:', transferError.response?.data || transferError.message);
        
        // Откатываем списание баланса
        await client.query('ROLLBACK');
        
        const errorData = transferError.response?.data;
        const errorDescription = errorData?.description || transferError.message;

        if (errorDescription.includes('STARS_TRANSFER_NOT_AVAILABLE')) {
          return res.status(400).json({ 
            success: false, 
            error: 'Вывод временно недоступен. Подожди первой оплаты в приложении (разблокируется через 0–48 часов)' 
          });
        }

        if (errorDescription.includes('BOT_NOT_FOUND') || errorDescription.includes('invalid token')) {
          return res.status(400).json({ 
            success: false, 
            error: 'Бот не настроен для переводов Stars. Проверьте настройки в BotFather.' 
          });
        }

        if (errorDescription.includes('INSUFFICIENT_FUNDS')) {
          return res.status(400).json({ 
            success: false, 
            error: 'Недостаточно средств у бота для перевода. Обратитесь к администратору.' 
          });
        }

        if (errorDescription.includes('USER_NOT_FOUND')) {
          return res.status(400).json({ 
            success: false, 
            error: 'Пользователь не найден. Убедитесь, что пользователь запускал бота.' 
          });
        }

        return res.status(500).json({ 
          success: false, 
          error: `Ошибка вывода: ${errorDescription}` 
        });
      }

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Вывод на TON Space ошибка:', err.message);
      
      res.status(500).json({ 
        success: false, 
        error: 'Внутренняя ошибка сервера. Попробуй позже.' 
      });
    } finally {
      client.release();
    }
  });

  // Альтернативный метод вывода через инвойс (если прямой перевод не работает)
  router.post('/withdraw-via-invoice', async (req, res) => {
    const { telegramId, amount } = req.body;

    if (!telegramId || !amount || amount < 10) {
      return res.status(400).json({ success: false, error: 'Минимум 10 ⭐' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Проверяем баланс
      const userRes = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1 FOR UPDATE',
        [telegramId]
      );

      if (userRes.rows.length === 0 || userRes.rows[0].balance < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Недостаточно ⭐ на балансе' 
        });
      }

      // Создаем инвойс для вывода
      const payload = `withdraw_${telegramId}_${Date.now()}`;
      
      const invoiceLink = await bot.telegram.createInvoiceLink({
        title: 'Вывод Stars на TON Space',
        description: `Вывод ${amount} Telegram Stars на ваш кошелек`,
        payload: payload,
        provider_token: '', // Пусто для Stars
        currency: 'XTR',
        prices: [{ label: `Вывод ${amount} Stars`, amount: -amount }], // Отрицательная сумма для вывода
      });

      // Списываем средства и записываем транзакцию
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      await client.query(
        `INSERT INTO transactions (telegram_id, type, amount, status, invoice_payload) 
         VALUES ($1, 'withdraw_tonspace', $2, 'pending', $3)`,
        [telegramId, amount, payload]
      );

      await client.query('COMMIT');

      res.json({ 
        success: true, 
        invoice_link: invoiceLink,
        message: `Перейдите по ссылке для получения ${amount} ⭐ на ваш TON Space`
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Withdraw invoice error:', err.message);
      
      if (err.message.includes('negative total')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Вывод через инвойс временно недоступен' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Ошибка создания вывода' 
      });
    } finally {
      client.release();
    }
  });

  // Проверка доступности вывода
  router.get('/withdraw-status/:telegramId', async (req, res) => {
    try {
      const { telegramId } = req.params;
      
      // Проверяем баланс пользователя
      const userRes = await pool.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Пользователь не найден' });
      }

      const balance = userRes.rows[0].balance;
      const canWithdraw = balance >= 10;

      res.json({
        success: true,
        can_withdraw: canWithdraw,
        balance: balance,
        min_amount: 10,
        message: canWithdraw ? `Доступно для вывода: ${balance} ⭐` : 'Минимум 10 ⭐ для вывода'
      });

    } catch (err) {
      console.error('Withdraw status error:', err);
      res.status(500).json({ success: false, error: 'Ошибка проверки статуса' });
    }
  });

  return router;
};
