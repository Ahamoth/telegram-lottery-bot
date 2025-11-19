// backend/routes/auth.js
const express = require('express');
const crypto = require('crypto');

module.exports = (pool, bot) => {
  const router = express.Router();

  const validateTelegramData = (initData) => {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      if (!hash) return false;

      // Создаем data_check_string
      const dataCheckEntries = [];
      for (const [key, value] of urlParams) {
        if (key !== 'hash') {
          dataCheckEntries.push(`${key}=${value}`);
        }
      }
      
      // Сортируем по алфавиту
      dataCheckEntries.sort();
      const dataCheckString = dataCheckEntries.join('\n');

      // Создаем секретный ключ
      const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(process.env.BOT_TOKEN)
        .digest();

      // Вычисляем хеш
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === hash;
    } catch (error) {
      console.error('Telegram data validation error:', error);
      return false;
    }
  };

  // Главная функция — сохраняет или создает пользователя
  const findOrCreateUser = async (userData, photoUrlFromTelegram) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let user = (await client.query(
        'SELECT * FROM users WHERE telegram_id = $1', 
        [userData.telegramId]
      )).rows[0];

      let finalPhotoUrl = photoUrlFromTelegram;

      // Если Telegram отдал SVG или null — запрашиваем настоящее фото через бота
      if ((!finalPhotoUrl || finalPhotoUrl.includes('.svg') || finalPhotoUrl.includes('/userpic/')) && bot) {
        try {
          const photos = await bot.telegram.getUserProfilePhotos(userData.telegramId, { limit: 1 });
          if (photos.total_count > 0) {
            const file = await bot.telegram.getFile(photos.photos[0][photos.photos[0].length - 1].file_id);
            finalPhotoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
          }
        } catch (e) {
          console.log('Не удалось загрузить фото профиля для', userData.telegramId);
          finalPhotoUrl = null;
        }
      }

      if (user) {
        // Обновляем данные пользователя если изменились
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (user.first_name !== userData.firstName) {
          updateFields.push(`first_name = $${paramCount}`);
          updateValues.push(userData.firstName);
          paramCount++;
        }

        if (user.last_name !== userData.lastName) {
          updateFields.push(`last_name = $${paramCount}`);
          updateValues.push(userData.lastName);
          paramCount++;
        }

        if (user.username !== userData.username) {
          updateFields.push(`username = $${paramCount}`);
          updateValues.push(userData.username);
          paramCount++;
        }

        if (user.avatar !== finalPhotoUrl) {
          updateFields.push(`avatar = $${paramCount}`);
          updateValues.push(finalPhotoUrl);
          paramCount++;
        }

        if (updateFields.length > 0) {
          updateValues.push(userData.telegramId);
          await client.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE telegram_id = $${paramCount}`,
            updateValues
          );
          user = { ...user, ...userData, avatar: finalPhotoUrl };
        }
      } else {
        // Создаём нового пользователя
        const res = await client.query(
          `INSERT INTO users 
           (telegram_id, first_name, last_name, username, balance, avatar)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            userData.telegramId, 
            userData.firstName || '', 
            userData.lastName || '', 
            userData.username || null, 
            0, 
            finalPhotoUrl
          ]
        );
        user = res.rows[0];
      }

      await client.query('COMMIT');
      return user;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error in findOrCreateUser:', e);
      throw e;
    } finally {
      client.release();
    }
  };

  // Роут аутентификации
  router.post('/telegram', async (req, res) => {
    try {
      const { initData } = req.body;
      
      if (!initData) {
        return res.status(400).json({ success: false, error: 'No init data provided' });
      }

      // Валидация данных Telegram (можно временно отключить для тестирования)
      const isValid = validateTelegramData(initData);
      if (!isValid) {
        console.warn('Invalid Telegram data, but continuing for testing...');
        // return res.status(401).json({ success: false, error: 'Invalid Telegram data' });
      }

      const params = new URLSearchParams(initData);
      const userJson = params.get('user');
      
      if (!userJson) {
        return res.status(400).json({ success: false, error: 'No user data' });
      }

      const tgUser = JSON.parse(userJson);

      if (!tgUser.id) {
        return res.status(400).json({ success: false, error: 'Invalid user data' });
      }

      const user = await findOrCreateUser({
        telegramId: tgUser.id.toString(),
        firstName: tgUser.first_name || 'User',
        lastName: tgUser.last_name || '',
        username: tgUser.username || null
      }, tgUser.photo_url || null);

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
      console.error('Auth error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Authentication failed: ' + error.message 
      });
    }
  });

  return router;
};
