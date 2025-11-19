const express = require('express');
const crypto = require('crypto');

module.exports = (pool, bot) => {  // ← bot обязателен для getUserProfilePhotos
  const router = express.Router();

  // Замените функцию validateTelegramData в auth.js:
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

  // === ГЛАВНАЯ ФУНКЦИЯ — СОХРАНЯЕТ РЕАЛЬНОЕ ФОТО ===
  const findOrCreateUser = async (userData, photoUrlFromTelegram) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let user = (await client.query('SELECT * FROM users WHERE telegram_id = $1', [userData.telegramId])).rows[0];

      let finalPhotoUrl = photoUrlFromTelegram;

      // Если Telegram отдал SVG или null — запрашиваем настоящее фото через бота
      if (!finalPhotoUrl || finalPhotoUrl.includes('.svg') || finalPhotoUrl.includes('/userpic/')) {
        try {
          const photos = await bot.telegram.getUserProfilePhotos(userData.telegramId, { limit: 1 });
          if (photos.total_count > 0) {
            const file = await bot.telegram.getFile(photos.photos[0][photos.photos[0].length - 1].file_id); // самое большое
            finalPhotoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
          }
        } catch (e) {
          console.log('Не удалось загрузить фото профиля для', userData.telegramId);
          finalPhotoUrl = null;
        }
      }

      if (user) {
        // Обновляем только если фото изменилось
        if (user.avatar !== finalPhotoUrl) {
          await client.query('UPDATE users SET avatar = $1 WHERE telegram_id = $2', [finalPhotoUrl, userData.telegramId]);
          user.avatar = finalPhotoUrl;
        }
      } else {
        // Создаём нового с реальным фото
        const res = await client.query(
          `INSERT INTO users 
           (telegram_id, first_name, last_name, username, balance, avatar)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [userData.telegramId, userData.firstName, userData.lastName, userData.username || null, 0, finalPhotoUrl]
        );
        user = res.rows[0];
      }

      await client.query('COMMIT');
      return user;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  // === РОУТ АВТОРИЗАЦИИ ===
  router.post('/telegram', async (req, res) => {
    try {
      const { initData } = req.body;
      if (!initData || !validateTelegramData(initData)) {
        return res.status(401).json({ success: false, error: 'Invalid Telegram data' });
      }

      const params = new URLSearchParams(initData);
      const userJson = params.get('user');
      if (!userJson) return res.status(400).json({ success: false, error: 'No user data' });

      const tgUser = JSON.parse(decodeURIComponent(userJson));

      const user = await findOrCreateUser({
        telegramId: tgUser.id.toString(),
        firstName: tgUser.first_name || '',
        lastName: tgUser.last_name || '',
        username: tgUser.username || null
      }, tgUser.photo_url || null);  // ← сначала пытаемся с тем, что отдал Telegram

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
          avatar: user.avatar  // ← теперь всегда настоящее фото или null
        }
      });
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ success: false, error: 'Authentication failed' });
    }
  });

  return router;
};

