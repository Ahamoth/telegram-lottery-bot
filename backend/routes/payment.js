const express = require('express');
const crypto = require('crypto');

module.exports = (pool) => {
  const router = express.Router();

  // Конфигурация платежей для Telegram Stars
  const PAYMENT_CONFIG = {
    // Для Telegram Stars оставляем пустым или 'TEST'
    provider_token: process.env.PROVIDER_TOKEN || 'TEST',
    currency: 'XTR', // Валюта Stars
    prices: {
      10: 10,   // 10 звезд = 10 единиц
      50: 50,   // 50 звезд = 50 единиц  
      100: 100  // 100 звезд = 100 единиц
    }
  };

  // Create payment invoice для Telegram Stars
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
        [telegramId, 'stars_deposit', amount, 'pending']
      );

      const payment = paymentResult.rows[0];

      // Для Telegram Stars
      res.json({
        success: true,
        payment: {
          id: payment.id,
          amount: amount,
          currency: 'XTR', // Telegram Stars currency
          description: `Purchase ${amount} Stars`,
          payload: JSON.stringify({
            paymentId: payment.id,
            telegramId: telegramId,
            amount: amount,
            product: 'stars'
          }),
          provider_token: PAYMENT_CONFIG.provider_token, // 'TEST' или пусто
          prices: [{
            label: `${amount} Telegram Stars`,
            amount: PAYMENT_CONFIG.prices[amount] || amount
          }]
        },
        stars_payment: true
      });

    } catch (error) {
      console.error('Create stars invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create stars invoice'
      });
    }
  });

  // Handle payment confirmation from Telegram Stars
  router.post('/confirm-payment', async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        telegram_payment_charge_id,
        provider_payment_charge_id,
        payload
      } = req.body;

      console.log('💰 Processing Stars payment confirmation:', {
        telegram_payment_charge_id,
        provider_payment_charge_id
      });

      let paymentData;
      try {
        paymentData = JSON.parse(payload);
      } catch (parseError) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Invalid payment data'
        });
      }

      const { paymentId, telegramId, amount } = paymentData;

      if (!telegramId || !amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Missing payment data'
        });
      }

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

      // Обновляем или создаем транзакцию
      let transaction;
      
      // Проверяем существующую pending транзакцию
      const existingTransaction = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2',
        [paymentId, 'pending']
      );

      if (existingTransaction.rows.length > 0) {
        // Обновляем существующую транзакцию
        const updateResult = await client.query(
          `UPDATE transactions SET 
           status = $1,
           provider_payment_charge_id = $2,
           telegram_payment_charge_id = $3,
           updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING *`,
          ['completed', provider_payment_charge_id, telegram_payment_charge_id, paymentId]
        );
        transaction = updateResult.rows[0];
      } else {
        // Создаем новую транзакцию
        const transactionResult = await client.query(
          `INSERT INTO transactions 
           (telegram_id, type, amount, status, provider_payment_charge_id, telegram_payment_charge_id) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING *`,
          [telegramId, 'stars_deposit', amount, 'completed', provider_payment_charge_id, telegram_payment_charge_id]
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

      console.log('✅ Stars payment confirmed successfully:', {
        telegramId,
        amount,
        newBalance,
        transactionId: transaction.id
      });

      res.json({
        success: true,
        newBalance: newBalance,
        transactionId: transaction.id,
        message: `Баланс успешно пополнен на ${amount} ⭐`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Confirm Stars payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm Stars payment'
      });
    } finally {
      client.release();
    }
  });

  // Демо-платежи для тестирования (без реальных платежей)
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
        [telegramId, 'demo_deposit', amount, 'completed', 'demo_provider_' + Date.now(), 'demo_telegram_' + Date.now()]
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

      console.log('✅ Demo payment processed:', { telegramId, amount, newBalance });

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

  // Get payment history
  router.get('/history/:telegramId', async (req, res) => {
    try {
      const { telegramId } = req.params;
      const { limit = 10 } = req.query;

      const paymentsResult = await pool.query(
        `SELECT 
          id,
          type,
          amount,
          status,
          provider_payment_charge_id,
          telegram_payment_charge_id,
          created_at
         FROM transactions 
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

  return router;
};
