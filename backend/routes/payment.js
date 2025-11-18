const express = require('express');
const crypto = require('crypto');

module.exports = (pool) => {
  const router = express.Router();

  // Create payment invoice
  router.post('/create-invoice', async (req, res) => {
    try {
      const { telegramId, amount, currency = 'XTR' } = req.body;

      if (!telegramId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Telegram ID and amount are required'
        });
      }

      if (amount < 1) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be at least 1 star'
        });
      }

      // Check if user exists
      const userResult = await pool.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Create payment record
      const paymentResult = await pool.query(
        `INSERT INTO transactions 
         (telegram_id, type, amount, status) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [telegramId, 'deposit', amount, 'pending']
      );

      const payment = paymentResult.rows[0];

      // Для демо-режима возвращаем успех сразу
      // В реальном приложении здесь будет интеграция с Telegram Payments API
      res.json({
        success: true,
        payment: {
          id: payment.id,
          amount: amount,
          currency: currency,
          description: `Пополнение баланса на ${amount} ⭐`,
          payload: JSON.stringify({
            paymentId: payment.id,
            telegramId: telegramId,
            amount: amount
          })
        },
        // Демо-режим: сразу возвращаем успешный платеж
        demoMode: true,
        message: 'Демо-режим: платеж успешно обработан'
      });

    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment invoice'
      });
    }
  });

  // Handle payment confirmation from Telegram
  router.post('/confirm-payment', async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        telegram_payment_charge_id,
        provider_payment_charge_id,
        payload
      } = req.body;

      // Для демо-режима принимаем платежи без проверки
      let paymentData;
      try {
        paymentData = JSON.parse(payload);
      } catch (parseError) {
        // Если payload не парсится, создаем демо-данные
        paymentData = {
          paymentId: 'demo_' + Date.now(),
          telegramId: req.body.telegramId || 'unknown',
          amount: req.body.amount || 10
        };
      }

      const { paymentId, telegramId, amount } = paymentData;

      console.log('💰 Processing payment:', { paymentId, telegramId, amount });

      // Проверяем существование пользователя
      const userResult = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
        [telegramId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Создаем или обновляем транзакцию
      let transaction;
      if (paymentId && paymentId.startsWith('demo_')) {
        // Демо-транзакция
        const transactionResult = await client.query(
          `INSERT INTO transactions 
           (telegram_id, type, amount, status, provider_payment_charge_id, telegram_payment_charge_id) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING *`,
          [telegramId, 'deposit', amount, 'completed', 'demo_provider', 'demo_telegram']
        );
        transaction = transactionResult.rows[0];
      } else {
        // Реальная транзакция
        const transactionResult = await client.query(
          `INSERT INTO transactions 
           (telegram_id, type, amount, status, provider_payment_charge_id, telegram_payment_charge_id) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING *`,
          [telegramId, 'deposit', amount, 'completed', provider_payment_charge_id, telegram_payment_charge_id]
        );
        transaction = transactionResult.rows[0];
      }

      // Обновляем баланс пользователя
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      // Получаем обновленный баланс
      const updatedUserResult = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      const newBalance = updatedUserResult.rows[0].balance;

      await client.query('COMMIT');

      console.log('✅ Payment processed successfully:', { telegramId, amount, newBalance });

      res.json({
        success: true,
        newBalance: newBalance,
        transactionId: transaction.id,
        message: `Баланс успешно пополнен на ${amount} ⭐`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Confirm payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm payment'
      });
    } finally {
      client.release();
    }
  });

  // Get payment history
  router.get('/history/:telegramId', async (req, res) => {
    try {
      const { telegramId } = req.params;
      const { limit = 10 } = req.query;

      const paymentsResult = await pool.query(
        `SELECT * FROM transactions 
         WHERE telegram_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [telegramId, limit]
      );

      res.json({
        success: true,
        payments: paymentsResult.rows
      });

    } catch (error) {
      console.error('Payment history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payment history'
      });
    }
  });

  // Демо-эндпоинт для тестирования платежей
  router.post('/demo-payment', async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { telegramId, amount } = req.body;

      if (!telegramId || !amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Telegram ID and amount are required'
        });
      }

      // Проверяем пользователя
      const userResult = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
        [telegramId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Создаем демо-транзакцию
      const transactionResult = await client.query(
        `INSERT INTO transactions 
         (telegram_id, type, amount, status, provider_payment_charge_id, telegram_payment_charge_id) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [telegramId, 'deposit', amount, 'completed', 'demo_provider_' + Date.now(), 'demo_telegram_' + Date.now()]
      );

      // Обновляем баланс
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      // Получаем обновленный баланс
      const updatedUserResult = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      const newBalance = updatedUserResult.rows[0].balance;

      await client.query('COMMIT');

      res.json({
        success: true,
        newBalance: newBalance,
        message: `Демо-платеж: баланс пополнен на ${amount} ⭐`,
        transactionId: transactionResult.rows[0].id
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Demo payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process demo payment'
      });
    } finally {
      client.release();
    }
  });

  return router;
};
