const express = require('express');
const crypto = require('crypto');

module.exports = (pool) => {
  const router = express.Router();

  // Validate Telegram Web App data
  const validateTelegramData = (initData) => {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      const authDate = params.get('auth_date');
      
      if (!hash || !authDate) {
        return false;
      }

      // Check if auth date is not too old (1 hour)
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - parseInt(authDate) > 3600) {
        return false;
      }

      // Remove hash and sort parameters
      params.delete('hash');
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      // Create secret key from bot token
      const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(process.env.BOT_TOKEN)
        .digest();
      
      // Calculate hash
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === hash;
    } catch (error) {
      console.error('Telegram validation error:', error);
      return false;
    }
  };

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
        
        // Проверяем наличие колонки avatar и обновляем если нужно
        if (!user.avatar) {
          const avatar = generateUserAvatar(userData);
          console.log('Updating user avatar:', avatar);
          await client.query(
            'UPDATE users SET avatar = $1 WHERE telegram_id = $2',
            [avatar, userData.telegramId]
          );
          user.avatar = avatar;
        }
      } else {
        // Генерируем аватар
        const avatar = generateUserAvatar(userData);
        console.log('Creating new user with avatar:', avatar);

        try {
          // Пытаемся создать пользователя с аватаром
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
              0, // Начинаем с 0 звезд
              avatar
            ]
          );

          user = newUserResult.rows[0];
          console.log('New user created:', user.telegram_id);
        } catch (insertError) {
          // Если ошибка из-за отсутствия колонки avatar, создаем без нее
          if (insertError.code === '42703') { // column does not exist
            console.log('Avatar column missing, creating user without avatar...');
            const newUserResult = await client.query(
              `INSERT INTO users 
               (telegram_id, first_name, last_name, username, balance) 
               VALUES ($1, $2, $3, $4, $5) 
               RETURNING *`,
              [
                userData.telegramId,
                userData.firstName || '',
                userData.lastName || '',
                userData.username || '',
                0
              ]
            );

            user = newUserResult.rows[0];
            user.avatar = generateUserAvatar(userData); // Добавляем аватар локально
            console.log('New user created (without avatar column):', user.telegram_id);
          } else {
            throw insertError;
          }
        }
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

  router.post('/telegram', async (req, res) => {
    console.log('🔐 Auth request received');
    
    try {
      const { initData } = req.body;
      
      if (!initData) {
        return res.status(401).json({ 
          success: false,
          error: 'Telegram authentication required' 
        });
      }

      // Validate Telegram data
      if (!validateTelegramData(initData)) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid Telegram authentication' 
        });
      }

      // Parse user data
      const params = new URLSearchParams(initData);
      const userParam = params.get('user');
      
      if (!userParam) {
        return res.status(401).json({ 
          success: false,
          error: 'User data not found' 
        });
      }

      const userData = JSON.parse(decodeURIComponent(userParam));
      console.log('Processing Telegram user:', userData.id);

      const user = await findOrCreateUser({
        telegramId: userData.id.toString(),
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username
      });

      const response = {
        success: true,
        user: {
          telegramId: user.telegram_id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          balance: user.balance,
          gamesPlayed: user.games_played || 0,
          gamesWon: user.games_won || 0,
          totalWinnings: user.total_winnings || 0,
          avatar: user.avatar || '👤'
        },
        mode: 'telegram'
      };

      console.log('Auth successful for user:', user.telegram_id);
      res.json(response);

    } catch (error) {
      console.error('❌ Auth error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Authentication failed' 
      });
    }
  });

  return router;
};
