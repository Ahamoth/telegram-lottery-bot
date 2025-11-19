const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get current user (for header)
router.get('/current', async (req, res) => {
  try {
    const { telegramId } = req.query;
    
    if (!telegramId) {
      return res.status(400).json({ success: false, error: 'Telegram ID is required' });
    }
    
    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    res.json({
      success: true,
      user: {
        telegramId: user.telegram_id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        username: user.username || '',
        balance: user.balance || 0,
        gamesPlayed: user.games_played || 0,
        gamesWon: user.games_won || 0,
        totalWinnings: user.total_winnings || 0,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user data' });
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

  // Update user avatar
  router.post('/avatar', async (req, res) => {
    try {
      const { telegramId, avatar } = req.body;
      
      if (!telegramId || !avatar) {
        return res.status(400).json({ error: 'Telegram ID and avatar are required' });
      }
      
      const userResult = await pool.query(
        'UPDATE users SET avatar = $1 WHERE telegram_id = $2 RETURNING *',
        [avatar, telegramId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      res.json({
        success: true,
        user: {
          telegramId: user.telegram_id,
          avatar: user.avatar
        }
      });
    } catch (error) {
      console.error('Avatar update error:', error);
      res.status(500).json({ error: 'Failed to update avatar' });
    }
  });

  return router;
};
