// backend/routes/payment.js
const express = require('express');
const router = express.Router();

module.exports = (pool, bot) => {
  // Создание ссылки на оплату Telegram Stars (самый надёжный способ)
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
        payload: payload,                     // ← точно такой же, как в БД!
        provider_token: '',                   // ← обязательно пусто для Stars
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
      throw new Error('Недостаточно ⭐ на балансе');
    }

    // Списываем с внутреннего баланса игры
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE telegram_id = $2',
      [amount, telegramId]
    );

    // Записываем транзакцию
    await client.query(
      `INSERT INTO transactions (telegram_id, type, amount, status) 
       VALUES ($1, 'withdraw_tonspace', $2, 'completed')`,
      [telegramId, amount]
    );

    await client.query('COMMIT');

    // ВЫВОДИМ ПОЛЬЗОВАТЕЛЮ НА ЕГО TON SPACE
    await bot.telegram.transferStars(
      telegramId,
      BigInt(amount) * 1000000000n  // 1 ⭐ = 1_000_000_000 нано-звёзд
    );

    res.json({ 
      success: true, 
      message: `${amount} ⭐ мгновенно зачислено на твой Telegram Wallet (TON Space)! ⭐` 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Вывод на TON Space ошибка:', err.message);

    // Если transferStars ещё не разблокирован — говорим пользователю
    if (err.message.includes('STARS_TRANSFER_NOT_AVAILABLE')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Вывод временно недоступен. Подожди первой оплаты в приложении (разблокируется через 0–48 часов)' 
      });
    }

    res.status(500).json({ success: false, error: 'Ошибка вывода. Попробуй позже.' });
  } finally {
    client.release();
  }
});
  return router;
};
