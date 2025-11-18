const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get current game
  router.get('/current', async (req, res) => {
    try {
      const gameResult = await pool.query(
        `SELECT g.*, 
         json_agg(
           json_build_object(
             'telegramId', gp.telegram_id,
             'number', gp.player_number,
             'name', gp.player_name,
             'avatar', gp.avatar,
             'isBot', gp.is_bot
           )
         ) as players
         FROM games g
         LEFT JOIN game_players gp ON g.id = gp.game_id
         WHERE g.status IN ('waiting', 'active')
         GROUP BY g.id
         ORDER BY g.created_at DESC
         LIMIT 1`
      );

      if (gameResult.rows.length > 0) {
        res.json(gameResult.rows[0]);
      } else {
        // Создаем новую игру
        const newGameResult = await pool.query(
          'INSERT INTO games (status, bank_amount) VALUES ($1, $2) RETURNING *',
          ['waiting', 0]
        );
        
        res.json({
          ...newGameResult.rows[0],
          players: []
        });
      }
    } catch (error) {
      console.error('Get game error:', error);
      res.status(500).json({ error: 'Failed to get game' });
    }
  });

  // Join game
  router.post('/join', async (req, res) => {
    try {
      const { telegramId, name, avatar } = req.body;
      
      // Находим текущую игру
      const gameResult = await pool.query(
        'SELECT * FROM games WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
        ['waiting']
      );
      
      let game;
      if (gameResult.rows.length === 0) {
        // Создаем новую игру
        const newGameResult = await pool.query(
          'INSERT INTO games (status, bank_amount) VALUES ($1, $2) RETURNING *',
          ['waiting', 0]
        );
        game = newGameResult.rows[0];
      } else {
        game = gameResult.rows[0];
      }
      
      // Проверяем, не в игре ли уже пользователь
      const existingPlayerResult = await pool.query(
        'SELECT * FROM game_players WHERE game_id = $1 AND telegram_id = $2',
        [game.id, telegramId]
      );
      
      if (existingPlayerResult.rows.length > 0) {
        return res.status(400).json({ error: 'Already in game' });
      }
      
      // Получаем занятые номера
      const usedNumbersResult = await pool.query(
        'SELECT player_number FROM game_players WHERE game_id = $1',
        [game.id]
      );
      
      const usedNumbers = usedNumbersResult.rows.map(row => row.player_number);
      const availableNumbers = [1,2,3,4,5,6,7,8,9,10].filter(n => !usedNumbers.includes(n));
      
      if (availableNumbers.length === 0) {
        return res.status(400).json({ error: 'Game is full' });
      }
      
      const userNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      
      // Добавляем игрока
      await pool.query(
        `INSERT INTO game_players 
         (game_id, telegram_id, player_number, player_name, avatar, is_bot) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [game.id, telegramId, userNumber, name, avatar, false]
      );
      
      // Обновляем банк
      const playersCountResult = await pool.query(
        'SELECT COUNT(*) FROM game_players WHERE game_id = $1',
        [game.id]
      );
      
      const bankAmount = playersCountResult.rows[0].count * 10;
      await pool.query(
        'UPDATE games SET bank_amount = $1 WHERE id = $2',
        [bankAmount, game.id]
      );
      
      // Обновляем баланс пользователя
      await pool.query(
        'UPDATE users SET balance = balance - 10 WHERE telegram_id = $1',
        [telegramId]
      );
      
      // Получаем обновленный баланс
      const userResult = await pool.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      
      res.json({
        success: true,
        userNumber,
        newBalance: userResult.rows[0].balance,
        bankAmount
      });
      
    } catch (error) {
      console.error('Join game error:', error);
      res.status(500).json({ error: 'Failed to join game' });
    }
  });

  return router;
};
