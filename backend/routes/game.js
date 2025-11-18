const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get current game
  router.get('/current', async (req, res) => {
    try {
      const gameResult = await pool.query(
        `SELECT g.*, 
         COALESCE(
           json_agg(
             json_build_object(
               'id', gp.id,
               'telegramId', gp.telegram_id,
               'number', gp.player_number,
               'name', gp.player_name,
               'avatar', gp.avatar,
               'isBot', gp.is_bot
             ) ORDER BY gp.player_number
           ) FILTER (WHERE gp.id IS NOT NULL), '[]'
         ) as players
         FROM games g
         LEFT JOIN game_players gp ON g.id = gp.game_id
         WHERE g.status IN ('waiting', 'active')
         GROUP BY g.id
         ORDER BY g.created_at DESC
         LIMIT 1`
      );

      if (gameResult.rows.length > 0) {
        const game = gameResult.rows[0];
        res.json({
          id: game.id,
          status: game.status,
          bankAmount: game.bank_amount,
          winningNumbers: game.winning_center ? {
            center: game.winning_center,
            left: game.winning_left,
            right: game.winning_right
          } : null,
          players: game.players,
          startTime: game.start_time,
          endTime: game.end_time,
          createdAt: game.created_at
        });
      } else {
        // Создаем новую игру
        const newGameResult = await pool.query(
          'INSERT INTO games (status, bank_amount) VALUES ($1, $2) RETURNING *',
          ['waiting', 0]
        );
        
        const newGame = newGameResult.rows[0];
        res.json({
          id: newGame.id,
          status: newGame.status,
          bankAmount: newGame.bank_amount,
          winningNumbers: null,
          players: [],
          startTime: newGame.start_time,
          endTime: newGame.end_time,
          createdAt: newGame.created_at
        });
      }
    } catch (error) {
      console.error('Get game error:', error);
      res.status(500).json({ error: 'Failed to get game state' });
    }
  });

  // Join game
  router.post('/join', async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { telegramId, name, avatar } = req.body;
      
      if (!telegramId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Telegram ID is required' });
      }

      // Находим текущую активную игру
      const gameResult = await client.query(
        'SELECT * FROM games WHERE status = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',
        ['waiting']
      );
      
      let game;
      if (gameResult.rows.length === 0) {
        // Создаем новую игру
        const newGameResult = await client.query(
          'INSERT INTO games (status, bank_amount) VALUES ($1, $2) RETURNING *',
          ['waiting', 0]
        );
        game = newGameResult.rows[0];
      } else {
        game = gameResult.rows[0];
      }
      
      // Проверяем, не в игре ли уже пользователь
      const existingPlayerResult = await client.query(
        'SELECT * FROM game_players WHERE game_id = $1 AND telegram_id = $2',
        [game.id, telegramId]
      );
      
      if (existingPlayerResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Already in game' });
      }
      
      // Получаем занятые номера
      const usedNumbersResult = await client.query(
        'SELECT player_number FROM game_players WHERE game_id = $1',
        [game.id]
      );
      
      const usedNumbers = usedNumbersResult.rows.map(row => row.player_number);
      const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(n => !usedNumbers.includes(n));
      
      if (availableNumbers.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Game is full' });
      }
      
      const userNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      
      // Проверяем баланс пользователя
      const userResult = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userBalance = userResult.rows[0].balance;
      if (userBalance < 10) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      
      // Добавляем игрока
      await client.query(
        `INSERT INTO game_players 
         (game_id, telegram_id, player_number, player_name, avatar, is_bot) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [game.id, telegramId, userNumber, name || 'Player', avatar || '👤', false]
      );
      
      // Обновляем банк
      const playersCountResult = await client.query(
        'SELECT COUNT(*) as count FROM game_players WHERE game_id = $1',
        [game.id]
      );
      
      const bankAmount = parseInt(playersCountResult.rows[0].count) * 10;
      await client.query(
        'UPDATE games SET bank_amount = $1 WHERE id = $2',
        [bankAmount, game.id]
      );
      
      // Списываем баланс
      await client.query(
        'UPDATE users SET balance = balance - 10 WHERE telegram_id = $1',
        [telegramId]
      );
      
      // Получаем обновленный баланс
      const updatedUserResult = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      
      const newBalance = updatedUserResult.rows[0].balance;
      
      // Получаем обновленный список игроков
      const playersResult = await client.query(
        `SELECT 
          id,
          telegram_id as "telegramId",
          player_number as "number", 
          player_name as "name",
          avatar,
          is_bot as "isBot"
         FROM game_players 
         WHERE game_id = $1 
         ORDER BY player_number`,
        [game.id]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        game: {
          id: game.id,
          status: game.status,
          bankAmount: bankAmount,
          players: playersResult.rows
        },
        userNumber: userNumber,
        newBalance: newBalance
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Join game error:', error);
      res.status(500).json({ error: 'Failed to join game' });
    } finally {
      client.release();
    }
  });

  // Start game
  router.post('/start', async (req, res) => {
    try {
      const gameResult = await pool.query(
        'SELECT * FROM games WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
        ['waiting']
      );
      
      if (gameResult.rows.length === 0) {
        return res.status(404).json({ error: 'No waiting game found' });
      }
      
      const game = gameResult.rows[0];
      
      // Проверяем количество игроков
      const playersCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM game_players WHERE game_id = $1',
        [game.id]
      );
      
      const playersCount = parseInt(playersCountResult.rows[0].count);
      if (playersCount < 2) {
        return res.status(400).json({ error: 'Not enough players (minimum 2)' });
      }
      
      // Обновляем статус игры
      await pool.query(
        'UPDATE games SET status = $1, start_time = $2 WHERE id = $3',
        ['active', new Date(), game.id]
      );
      
      res.json({
        success: true,
        game: {
          id: game.id,
          status: 'active',
          bankAmount: game.bank_amount,
          playersCount: playersCount
        }
      });
      
    } catch (error) {
      console.error('Start game error:', error);
      res.status(500).json({ error: 'Failed to start game' });
    }
  });

  // Finish game with winners
  router.post('/finish', async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { gameId, winningNumbers } = req.body;
      
      if (!gameId || !winningNumbers) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Game ID and winning numbers are required' });
      }
      
      // Проверяем игру
      const gameResult = await client.query(
        'SELECT * FROM games WHERE id = $1 FOR UPDATE',
        [gameId]
      );
      
      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Game not found' });
      }
      
      const game = gameResult.rows[0];
      
      if (game.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Game is not active' });
      }
      
      // Получаем всех игроков
      const playersResult = await client.query(
        `SELECT 
          telegram_id,
          player_number,
          player_name,
          avatar,
          is_bot
         FROM game_players 
         WHERE game_id = $1`,
        [gameId]
      );
      
      const players = playersResult.rows;
      
      // Расчет призов
      const prizeCenter = Math.floor(game.bank_amount * 0.5);
      const prizeSide = Math.floor(game.bank_amount * 0.25);
      
      const winners = [];
      
      // Находим победителей
      const centerWinners = players.filter(player => 
        player.player_number === winningNumbers.center
      );
      
      const leftWinners = players.filter(player => 
        player.player_number === winningNumbers.left
      );
      
      const rightWinners = players.filter(player => 
        player.player_number === winningNumbers.right
      );
      
      // Обновляем балансы и статистику реальных пользователей
      for (const winner of centerWinners) {
        if (!winner.is_bot) {
          await client.query(
            `UPDATE users SET 
              balance = balance + $1,
              games_played = COALESCE(games_played, 0) + 1,
              games_won = COALESCE(games_won, 0) + 1,
              total_winnings = COALESCE(total_winnings, 0) + $1
             WHERE telegram_id = $2`,
            [prizeCenter, winner.telegram_id]
          );
        }
        
        winners.push({
          telegramId: winner.telegram_id,
          name: winner.player_name,
          avatar: winner.avatar,
          number: winner.player_number,
          prize: prizeCenter,
          prizeType: 'Главный приз',
          type: 'center',
          isBot: winner.is_bot
        });
      }
      
      for (const winner of leftWinners) {
        if (!winner.is_bot) {
          await client.query(
            `UPDATE users SET 
              balance = balance + $1,
              games_played = COALESCE(games_played, 0) + 1,
              games_won = COALESCE(games_won, 0) + 1,
              total_winnings = COALESCE(total_winnings, 0) + $1
             WHERE telegram_id = $2`,
            [prizeSide, winner.telegram_id]
          );
        }
        
        winners.push({
          telegramId: winner.telegram_id,
          name: winner.player_name,
          avatar: winner.avatar,
          number: winner.player_number,
          prize: prizeSide,
          prizeType: 'Левый приз',
          type: 'left',
          isBot: winner.is_bot
        });
      }
      
      for (const winner of rightWinners) {
        if (!winner.is_bot) {
          await client.query(
            `UPDATE users SET 
              balance = balance + $1,
              games_played = COALESCE(games_played, 0) + 1,
              games_won = COALESCE(games_won, 0) + 1,
              total_winnings = COALESCE(total_winnings, 0) + $1
             WHERE telegram_id = $2`,
            [prizeSide, winner.telegram_id]
          );
        }
        
        winners.push({
          telegramId: winner.telegram_id,
          name: winner.player_name,
          avatar: winner.avatar,
          number: winner.player_number,
          prize: prizeSide,
          prizeType: 'Правый приз',
          type: 'right',
          isBot: winner.is_bot
        });
      }
      
      // Обновляем статистику для проигравших реальных пользователей
      const allRealPlayers = players.filter(p => !p.is_bot);
      const winningRealPlayers = winners.filter(w => !w.isBot).map(w => w.telegramId);
      const losingRealPlayers = allRealPlayers.filter(p => !winningRealPlayers.includes(p.telegram_id));
      
      for (const loser of losingRealPlayers) {
        await client.query(
          'UPDATE users SET games_played = COALESCE(games_played, 0) + 1 WHERE telegram_id = $1',
          [loser.telegram_id]
        );
      }
      
      // Сохраняем выигрышные номера и завершаем игру
      await client.query(
        `UPDATE games SET 
          status = $1,
          winning_center = $2,
          winning_left = $3,
          winning_right = $4,
          end_time = $5
         WHERE id = $6`,
        ['finished', winningNumbers.center, winningNumbers.left, winningNumbers.right, new Date(), gameId]
      );
      
      // Сохраняем победителей в таблицу winners
      for (const winner of winners) {
        await client.query(
          `INSERT INTO winners 
           (game_id, telegram_id, prize, prize_type, player_number) 
           VALUES ($1, $2, $3, $4, $5)`,
          [gameId, winner.telegramId, winner.prize, winner.prizeType, winner.number]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        game: {
          id: game.id,
          status: 'finished',
          bankAmount: game.bank_amount,
          winningNumbers: winningNumbers
        },
        winners: winners,
        prizes: {
          center: prizeCenter,
          left: prizeSide,
          right: prizeSide
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Finish game error:', error);
      res.status(500).json({ error: 'Failed to finish game' });
    } finally {
      client.release();
    }
  });

  // Leave game
  router.post('/leave', async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { telegramId } = req.body;
      
      if (!telegramId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Telegram ID is required' });
      }
      
      // Находим текущую игру
      const gameResult = await client.query(
        'SELECT * FROM games WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
        ['waiting']
      );
      
      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No active game found' });
      }
      
      const game = gameResult.rows[0];
      
      // Проверяем, есть ли пользователь в игре
      const playerResult = await client.query(
        'SELECT * FROM game_players WHERE game_id = $1 AND telegram_id = $2',
        [game.id, telegramId]
      );
      
      if (playerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Player not found in game' });
      }
      
      // Удаляем игрока из игры
      await client.query(
        'DELETE FROM game_players WHERE game_id = $1 AND telegram_id = $2',
        [game.id, telegramId]
      );
      
      // Возвращаем баланс
      await client.query(
        'UPDATE users SET balance = balance + 10 WHERE telegram_id = $1',
        [telegramId]
      );
      
      // Обновляем банк
      const playersCountResult = await client.query(
        'SELECT COUNT(*) as count FROM game_players WHERE game_id = $1',
        [game.id]
      );
      
      const bankAmount = parseInt(playersCountResult.rows[0].count) * 10;
      await client.query(
        'UPDATE games SET bank_amount = $1 WHERE id = $2',
        [bankAmount, game.id]
      );
      
      // Получаем обновленный баланс
      const userResult = await client.query(
        'SELECT balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      
      const newBalance = userResult.rows[0].balance;
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Successfully left the game',
        newBalance: newBalance
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Leave game error:', error);
      res.status(500).json({ error: 'Failed to leave game' });
    } finally {
      client.release();
    }
  });

  // Get game history
  router.get('/history/:telegramId', async (req, res) => {
    try {
      const { telegramId } = req.params;
      
      const historyResult = await pool.query(
        `SELECT 
          g.id,
          g.status,
          g.bank_amount as "bankAmount",
          g.winning_center as "winningCenter",
          g.winning_left as "winningLeft", 
          g.winning_right as "winningRight",
          g.created_at as "createdAt",
          w.prize,
          w.prize_type as "prizeType",
          w.player_number as "playerNumber"
         FROM games g
         LEFT JOIN winners w ON g.id = w.game_id AND w.telegram_id = $1
         WHERE g.status = 'finished'
         AND (EXISTS (
           SELECT 1 FROM game_players gp 
           WHERE gp.game_id = g.id AND gp.telegram_id = $1
         ) OR w.telegram_id = $1)
         ORDER BY g.created_at DESC
         LIMIT 20`,
        [telegramId]
      );
      
      const games = historyResult.rows.map(row => ({
        id: row.id,
        status: row.status,
        bankAmount: row.bankAmount,
        winningNumbers: row.winningCenter ? {
          center: row.winningCenter,
          left: row.winningLeft,
          right: row.winningRight
        } : null,
        playerNumber: row.playerNumber,
        prize: row.prize,
        prizeType: row.prizeType,
        createdAt: row.createdAt
      }));
      
      res.json({
        success: true,
        games: games
      });
      
    } catch (error) {
      console.error('Game history error:', error);
      res.status(500).json({ error: 'Failed to get game history' });
    }
  });

  // Add bot to game (для тестирования)
  router.post('/add-bot', async (req, res) => {
    try {
      const { gameId } = req.body;
      
      const gameResult = await pool.query(
        'SELECT * FROM games WHERE id = $1',
        [gameId]
      );
      
      if (gameResult.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      const game = gameResult.rows[0];
      
      if (game.status !== 'waiting') {
        return res.status(400).json({ error: 'Game is not waiting for players' });
      }
      
      // Получаем занятые номера
      const usedNumbersResult = await pool.query(
        'SELECT player_number FROM game_players WHERE game_id = $1',
        [gameId]
      );
      
      const usedNumbers = usedNumbersResult.rows.map(row => row.player_number);
      const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(n => !usedNumbers.includes(n));
      
      if (availableNumbers.length === 0) {
        return res.status(400).json({ error: 'Game is full' });
      }
      
      const botNumber = availableNumbers[0];
      const botAvatars = ['🤖', '👾', '🤡', '💀', '👻', '🐵', '🐸', '🦁', '🐲', '🦄'];
      const botNames = ['Бот_Алекс', 'Бот_Макс', 'Бот_Даня', 'Бот_Саша', 'Бот_Костя', 'Бот_Ник', 'Бот_Майк', 'Бот_Джон'];
      
      const randomIndex = Math.floor(Math.random() * botAvatars.length);
      const botAvatar = botAvatars[randomIndex];
      const botName = botNames[randomIndex % botNames.length];
      
      await pool.query(
        `INSERT INTO game_players 
         (game_id, telegram_id, player_number, player_name, avatar, is_bot) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [gameId, `bot-${Date.now()}`, botNumber, botName, botAvatar, true]
      );
      
      // Обновляем банк
      const playersCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM game_players WHERE game_id = $1',
        [gameId]
      );
      
      const bankAmount = parseInt(playersCountResult.rows[0].count) * 10;
      await pool.query(
        'UPDATE games SET bank_amount = $1 WHERE id = $2',
        [bankAmount, gameId]
      );
      
      res.json({
        success: true,
        bot: {
          name: botName,
          number: botNumber,
          avatar: botAvatar
        },
        bankAmount: bankAmount
      });
      
    } catch (error) {
      console.error('Add bot error:', error);
      res.status(500).json({ error: 'Failed to add bot' });
    }
  });

  return router;
};
