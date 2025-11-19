const express = require('express');
const crypto = require('crypto');

module.exports = (pool) => {
  const router = express.Router();

  // Валидация initData от Telegram
  const validateTelegramData = (initData) => {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      const authDate = params.get('auth_date');
      
      if (!hash || !authDate) return false;

      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - parseInt(authDate) > 3600) return false;

      params.delete('hash');
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(process.env.BOT_TOKEN)
        .digest();
      
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === hash;
    } catch (error) {
      console.error('Telegram validation error:', error);
      return false;
    }
  };

  // Теперь просто возвращаем photo_url из Telegram — это уже готовая ссылка на фото 640×640
  const getTelegramPhotoUrl = (tgUser) => {
    return tgUser?.photo_url || null;
  };

  const findOrCreateUser = async (userData, tgUser) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [userData.telegramId]
      );

      let user;

      if (userResult.rows.length > 0) {
        user = userResult.rows[0];

        // Обновляем фото, если оно изменилось или было null
        const newPhotoUrl = getTelegramPhotoUrl(tgUser);
        if (user.avatar !== newPhotoUrl) {
          await client.query(
            'UPDATE users SET avatar = $1 WHERE telegram_id = $2',
            [newPhotoUrl, userData.telegramId]
          );
          user.avatar = newPhotoUrl;
        }
      } else {
        // Создаём нового пользователя с настоящим фото
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
            0,
            getTelegramPhotoUrl(tgUser)  // ← реальное фото сразу!
          ]
        );
        user = newUserResult.rows[0];
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
    console.log('Auth request received');
    
    try {
      const { initData } = req.body;
      
      if (!initData || !validateTelegramData(initData)) {
        return res.status(401).json({ success: false, error: 'Invalid Telegram data' });
      }

      const params = new URLSearchParams(initData);
      const userParam = params.get('user');
      if (!userParam) {
        return res.status(401).json({ success: false, error: 'No user data' });
      }

      const tgUser = JSON.parse(decodeURIComponent(userParam));

      const user = await findOrCreateUser({
        telegramId: tgUser.id.toString(),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username
      }, tgUser);  // передаём полный объект tgUser

      res.json({
        success: true,
        user: {
          telegramId: user.telegram_id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          balance: user.balance || 0,
          gamesPlayed: user.games_played || 0,
          gamesWon: user.games_won || 0,
          totalWinnings: user.total_winnings || 0,
          avatar: user.avatar  // ← теперь это настоящая ссылка https://... или null
        },
        mode: 'telegram'
      });

    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ success: false, error: 'Authentication failed' });
    }
  });

  return router;
};
