const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Генерация аватара на основе данных пользователя
  const generateUserAvatar = (userData) => {
    if (!userData) return '👤';
    
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
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Проверяем существующего пользователя
      const userResult = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [userData.telegramId]
      );

      let user;

      if (userResult.rows.length > 0) {
        user = userResult.rows[0];
        console.log('User found:', user.telegram_id);
      } else {
        // Генерируем аватар
        const avatar = generateUserAvatar(userData);
        console.log('Creating new user with avatar:', avatar);

        // Создаем нового пользователя
        const newUserResult = await client.query(
          `INSERT INTO users 
           (telegram_id, first_name, last_name, username, balance, avatar) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING *`,
          [
            userData.telegramId,
            userData.firstName || '',
            userData.lastName || '',
            userData.username || '',
            1000,
            avatar
          ]
        );

        user = newUserResult.rows[0];
        console.log('New user created:', user.telegram_id);
      }

      await client.query('COMMIT');
      return user;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error in findOrCreateUser:', error);
      throw error;
    } finally {
      client.release();
    }
  };

  // Parse Telegram initData safely
  const parseTelegramData = (initData) => {
    if (!initData) return null;
    
    try {
      const params = new URLSearchParams(initData);
      const userParam = params.get('user');
      
      if (userParam) {
        return JSON.parse(decodeURIComponent(userParam));
      }
    } catch (error) {
      console.log('Failed to parse Telegram initData:', error.message);
    }
    
    return null;
  };

  // Create demo user data
  const createDemoUser = () => {
    const demoId = 'demo-' + Math.random().toString(36).substr(2, 9);
    return {
      id: demoId,
      first_name: 'Demo',
      last_name: 'User',
      username: 'demo_user_' + Math.random().toString(36).substr(2, 5)
    };
  };

  router.post('/telegram', async (req, res) => {
    console.log('🔐 Auth request received');
    
    try {
      const { initData } = req.body;
      
      if (!initData) {
        console.log('No initData provided, using demo mode');
      }

      let userData = parseTelegramData(initData);
      
      // Если не удалось распарсить Telegram данные, используем демо пользователя
      if (!userData) {
        userData = createDemoUser();
        console.log('Using demo user:', userData.id);
      }

      console.log('Processing user:', userData);

      const user = await findOrCreateUser({
        telegramId: userData.id.toString(),
        firstName: userData.first_name || 'User',
        lastName: userData.last_name || '',
        username: userData.username || ''
      });

      const response = {
        success: true,
        user: {
          telegramId: user.telegram_id,
          firstName: user.first_name || 'User',
          lastName: user.last_name || '',
          username: user.username || '',
          balance: user.balance || 1000,
          gamesPlayed: user.games_played || 0,
          gamesWon: user.games_won || 0,
          totalWinnings: user.total_winnings || 0,
          avatar: user.avatar || '👤'
        },
        mode: userData.id.toString().startsWith('demo-') ? 'demo' : 'telegram'
      };

      console.log('Auth successful for user:', user.telegram_id);
      res.json(response);

    } catch (error) {
      console.error('❌ Auth error:', error);
      
      // Fallback response if everything fails
      const fallbackUser = createDemoUser();
      res.json({
        success: true,
        user: {
          telegramId: fallbackUser.id,
          firstName: fallbackUser.first_name,
          lastName: fallbackUser.last_name,
          username: fallbackUser.username,
          balance: 1000,
          gamesPlayed: 0,
          gamesWon: 0,
          totalWinnings: 0,
          avatar: '🤖'
        },
        mode: 'fallback'
      });
    }
  });

  // Simple health check for auth route
  router.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      message: 'Auth route is working',
      timestamp: new Date().toISOString()
    });
  });

  return router;
};
