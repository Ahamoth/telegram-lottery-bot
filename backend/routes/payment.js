// routes/payment.js
const express = require('express');
const router = express.Router();

module.exports = (pool, bot) => {  // bot может быть null!

  router.post('/create-invoice-link', async (req, res) => {
    try {
      const { telegramId, amount } = req.body;

      if (!telegramId || !amount || amount < 1) {
        return res.status(400).json({ success: false, error: 'Invalid data' });
      }

      if (!bot) {
        console.error('Bot not loaded – cannot create invoice');
        return res.status(500).json({ success: false, error: 'Bot not ready' });
      }

      // Проверяем пользователя
      const user = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
      if (user.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });

      // Уникальный payload
      const payload = `stars_${telegramId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const invoiceLink = await bot.telegram.createInvoiceLink({
        title: 'Пополнение баланса',
        description: `+${amount} Telegram Stars`,
        payload: payload,
        provider_token: '',           // ← обязательно пусто!
        currency: 'XTR',
        prices: [{ label: `${amount} Telegram Stars`, amount: amount }],
      });

      res.json({ success: true, invoice_link: invoiceLink });

    } catch (err) {
      console.error('Create invoice error:', err.message);
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
