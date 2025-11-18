const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get user profile
  router.get('/profile/:telegramId', async (req, res) => {
    try {
      const { telegramId } = req.params;
      
      const userResult = await pool.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      res.json({
        success: true,
        user: {
          telegramId: user.telegram_id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          balance: user.balance,
          gamesPlayed: user.games_played,
          gamesWon: user.games_won,
          totalWinnings: user.total_winnings
        }
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  // Update user balance
  router.post('/balance', async (req, res) => {
    try {
      const { telegramId, amount } = req.body;
      
      const userResult = await pool.query(
        'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2 RETURNING *',
        [amount, telegramId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      res.json({
        success: true,
        newBalance: user.balance,
        message: `Balance updated by ${amount}`
      });
    } catch (error) {
      console.error('Balance update error:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  });

  return router;
};
