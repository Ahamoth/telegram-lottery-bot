const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Find or create user
  const findOrCreateUser = async (userData) => {
    try {
      // Проверяем существующего пользователя
      const userResult = await pool.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [userData.telegramId]
      );

      if (userResult.rows.length > 0) {
        return userResult.rows[0];
      }

      // Создаем нового пользователя
      const newUserResult = await pool.query(
        `INSERT INTO users 
         (telegram_id, first_name, last_name, username, balance) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          userData.telegramId,
          userData.firstName,
          userData.lastName,
          userData.username,
          1000
        ]
      );

      return newUserResult.rows[0];
    } catch (error) {
      console.error('Database error in findOrCreateUser:', error);
      throw error;
    }
  };

  router.post('/telegram', async (req, res) => {
    try {
      const { initData } = req.body;
      
      let userData;
      
      // Парсим данные Telegram или создаем демо
      if (initData) {
        try {
          const params = new URLSearchParams(initData);
          const userParam = params.get('user');
          if (userParam) {
            userData = JSON.parse(decodeURIComponent(userParam));
          }
        } catch (error) {
          console.log('Failed to parse initData, using demo user');
        }
      }
      
      if (!userData) {
        // Создаем демо пользователя
        userData = {
          id: Math.random().toString(36).substr(2, 9),
          first_name: 'Demo',
          last_name: 'User',
          username: 'demo_user_' + Math.random().toString(36).substr(2, 5)
        };
      }

      const user = await findOrCreateUser({
        telegramId: userData.id.toString(),
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username
      });

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
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  return router;
};
