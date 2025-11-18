const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const router = express.Router();

// Get current game state
router.get('/current', async (req, res) => {
  try {
    let game = await Game.findOne({ status: { $in: ['waiting', 'active'] } })
      .sort({ createdAt: -1 });
    
    if (!game) {
      game = new Game({
        players: [],
        status: 'waiting',
        bankAmount: 0
      });
      await game.save();
    }
    
    res.json(game);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// Join game
router.post('/join', async (req, res) => {
  try {
    const { telegramId, name, avatar } = req.body;
    
    let game = await Game.findOne({ status: 'waiting' })
      .sort({ createdAt: -1 });
    
    if (!game) {
      game = new Game({ 
        players: [], 
        status: 'waiting', 
        bankAmount: 0 
      });
    }
    
    // Check if user already in game
    const existingPlayer = game.players.find(p => p.telegramId === telegramId);
    if (existingPlayer) {
      return res.status(400).json({ error: 'Already in game' });
    }
    
    // Check user balance
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.balance < 10) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Assign number
    const usedNumbers = game.players.map(p => p.number);
    const availableNumbers = [1,2,3,4,5,6,7,8,9,10].filter(n => !usedNumbers.includes(n));
    
    if (availableNumbers.length === 0) {
      return res.status(400).json({ error: 'Game is full' });
    }
    
    const userNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    
    // Add player
    game.players.push({
      telegramId,
      number: userNumber,
      name: name || 'Player',
      avatar: avatar || '⭐',
      isBot: false
    });
    
    // Update bank
    game.bankAmount = game.players.length * 10;
    
    // Deduct balance
    user.balance -= 10;
    await user.save();
    
    await game.save();
    
    res.json({
      success: true,
      game,
      userNumber,
      newBalance: user.balance
    });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Start game
router.post('/start', async (req, res) => {
  try {
    const game = await Game.findOne({ status: 'waiting' })
      .sort({ createdAt: -1 });
    
    if (!game || game.players.length < 2) {
      return res.status(400).json({ error: 'Not enough players' });
    }
    
    game.status = 'active';
    game.startTime = new Date();
    await game.save();
    
    res.json({ success: true, game });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Finish game and determine winners
router.post('/finish', async (req, res) => {
  try {
    const { gameId, winningNumbers } = req.body;
    
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Calculate prizes
    const prizeCenter = Math.floor(game.bankAmount * 0.5);
    const prizeSide = Math.floor(game.bankAmount * 0.25);
    
    // Find winners
    const winners = [];
    
    // Center winner (50%)
    const centerWinners = game.players.filter(player => 
      player.number === winningNumbers.center
    );
    
    // Left winner (25%)
    const leftWinners = game.players.filter(player => 
      player.number === winningNumbers.left
    );
    
    // Right winner (25%)
    const rightWinners = game.players.filter(player => 
      player.number === winningNumbers.right
    );
    
    // Update winners' balances
    for (const winner of centerWinners) {
      if (!winner.isBot) {
        const user = await User.findOne({ telegramId: winner.telegramId });
        if (user) {
          user.balance += prizeCenter;
          user.gamesPlayed = (user.gamesPlayed || 0) + 1;
          user.gamesWon = (user.gamesWon || 0) + 1;
          user.totalWinnings = (user.totalWinnings || 0) + prizeCenter;
          await user.save();
        }
      }
      winners.push({ ...winner.toObject(), prize: prizeCenter, type: 'center' });
    }
    
    for (const winner of leftWinners) {
      if (!winner.isBot) {
        const user = await User.findOne({ telegramId: winner.telegramId });
        if (user) {
          user.balance += prizeSide;
          user.gamesPlayed = (user.gamesPlayed || 0) + 1;
          user.gamesWon = (user.gamesWon || 0) + 1;
          user.totalWinnings = (user.totalWinnings || 0) + prizeSide;
          await user.save();
        }
      }
      winners.push({ ...winner.toObject(), prize: prizeSide, type: 'left' });
    }
    
    for (const winner of rightWinners) {
      if (!winner.isBot) {
        const user = await User.findOne({ telegramId: winner.telegramId });
        if (user) {
          user.balance += prizeSide;
          user.gamesPlayed = (user.gamesPlayed || 0) + 1;
          user.gamesWon = (user.gamesWon || 0) + 1;
          user.totalWinnings = (user.totalWinnings || 0) + prizeSide;
          await user.save();
        }
      }
      winners.push({ ...winner.toObject(), prize: prizeSide, type: 'right' });
    }
    
    // Update game
    game.winningNumbers = winningNumbers;
    game.winners = winners;
    game.status = 'finished';
    game.endTime = new Date();
    
    await game.save();
    
    res.json({
      success: true,
      game,
      winners
    });
  } catch (error) {
    console.error('Finish game error:', error);
    res.status(500).json({ error: 'Failed to finish game' });
  }
});

module.exports = router;
