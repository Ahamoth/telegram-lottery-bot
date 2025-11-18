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

      // For Telegram Stars, we return the payment details
      // In a real implementation, you would integrate with Telegram Payments API
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
        }
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

      if (!telegram_payment_charge_id || !payload) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Missing required payment data'
        });
      }

      const paymentData = JSON.parse(payload);
      const { paymentId, telegramId, amount } = paymentData;

      // Verify payment exists and is pending
      const paymentResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE',
        [paymentId, 'pending']
      );

      if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Payment not found or already processed'
        });
      }

      // Update payment status
      await client.query(
        `UPDATE transactions SET 
         status = $1,
         provider_payment_charge_id = $2,
         telegram_payment_charge_id = $3,
         updated_at = $4
         WHERE id = $5`,
        ['completed', provider_payment_charge_id, telegram_payment_charge_id, new Date(), paymentId]
      );

      // Update user balance
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
        [amount, telegramId]
      );

      // Get updated balance
      const userResult = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        newBalance: userResult.rows[0].balance,
        message: `Balance successfully topped up with ${amount} ⭐`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Confirm payment error:', error);
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

  return router;
};
