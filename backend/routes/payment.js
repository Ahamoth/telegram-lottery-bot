// routes/payment.js
const express = require('express');
const router = express.Router();

module.exports = (pool, bot) => {  // ← теперь принимает bot!

  // Создаём invoice link для Telegram Stars (самый надёжный способ)
  router.post('/create-invoice-link', async (req, res) => {
    try {
      const { telegramId, amount } = req.body;

      if (!telegramId || !amount || amount < 1) {
        return res.status(400).json({ success: false, error: 'Invalid data' });
      }

      // Проверяем пользователя
      const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Создаём запись о транзакции заранее (чтобы потом найти по payload)
      const transRes = await pool.query(
        `INSERT INTO transactions 
         (telegram_id, type, amount, status, invoice_payload) 
         VALUES ($1, 'stars_deposit', $2, 'pending', $3) 
         RETURNING id`,
        [telegramId, amount, `stars_${telegramId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`]
      );

      const payload = `stars_${transRes.rows[0].id}`;

      const invoiceLink = await bot.telegram.createInvoiceLink({
        title: 'Пополнение баланса ⭐',
        description: `Пополнение на ${amount} Telegram Stars`,
        payload: payload,
        provider_token: '', // ← обязательно пусто для Stars!
        currency: 'XTR',
        prices: [{ label: `${amount} Telegram Stars`, amount: amount }],
      });

      res.json({
        success: true,
        invoice_link: invoiceLink
      });

    } catch (err) {
      console.error('Create invoice link error:', err);
      res.status(500).json({ success: false, error: 'Failed to create invoice' });
    }
  });

  // Оставляем демо-платёж (если нужен для теста)
  router.post('/demo-payment', async (req, res) => {
    // ... (твой старый код демо-платежа можно оставить без изменений)
    // если не нужен — просто удали этот роут
  });

  // История платежей — оставляем
  router.get('/history/:telegramId', async (req, res) => {
    // ... твой старый код
  });

  return router;
};
