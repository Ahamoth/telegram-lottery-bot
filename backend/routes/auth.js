const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Генерация аватара на основе данных пользователя
  const generateUserAvatar = (userData) => {
    const emojiAvatars = ['😊', '😎', '🤠', '👨‍💻', '👩‍💻', '🦊', '🐯', '🐶', '🐱', '🐼'];
    
    if (userData.username) {
      const firstChar = userData.username.charAt(0).toUpperCase();
      const emojiIndex = firstChar.charCodeAt(0) % emojiAvatars.length;
      return emojiAvatars[emojiIndex];
    } else if (userData.first_name) {
      const firstChar = userData.first_name.charAt(0).toUpperCase();
      const emojiIndex = firstChar.charCodeAt(0) % emojiAvatars.length;
      return emojiAvatars[emojiIndex];
    }
    
    return '👤';
  };

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

      // Генерируем аватар
      const avatar = generateUserAvatar(userData);

      // Создаем нового пользователя
      const newUserResult = await pool.query(
        `INSERT INTO users 
         (telegram_id, first_name, last_name, username, balance, avatar) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          userData.telegramId,
          userData.firstName,
          userData.lastName,
          userData.username,
          1000,
          avatar
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
          totalWinnings: user.total_winnings,
          avatar: user.avatar
        }
      });
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Обновление аватара пользователя
  router.post('/update-avatar', async (req, res) => {
    try {
      const { telegramId, avatar } = req.body;
      
      if (!telegramId || !avatar) {
        return res.status(400).json({ error: 'Telegram ID and avatar are required' });
      }

      const result = await pool.query(
        'UPDATE users SET avatar = $1 WHERE telegram_id = $2 RETURNING *',
        [avatar, telegramId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      res.json({
        success: true,
        user: {
          telegramId: user.telegram_id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          balance: user.balance,
          avatar: user.avatar
        }
      });
    } catch (error) {
      console.error('Update avatar error:', error);
      res.status(500).json({ error: 'Failed to update avatar' });
    }
  });

  return router;
};
