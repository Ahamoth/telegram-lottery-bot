const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const router = express.Router();

// Get current game state
router.get('/current', async (req, res) => {
  try {
    let game = await Game.findOne({ status: { $in: ['waiting', 'active'] } });
    
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
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// Join game
router.post('/join', async (req, res) => {
  try {
    const { telegramId, name, avatar } = req.body;
    
    let game = await Game.findOne({ status: 'waiting' });
    if (!game) {
      game = new Game({ players: [], status: 'waiting', bankAmount: 0 });
    }
    
    // Check if user already in game
    const existingPlayer = game.players.find(p => p.telegramId === telegramId);
    if (existingPlayer) {
      return res.status(400).json({ error: 'Already in game' });
    }
    
    // Check balance
    const user = await User.findOne({ telegramId });
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
      name,
      avatar,
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
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Start game
router.post('/start', async (req, res) => {
  try {
    const game = await Game.findOne({ status: 'waiting' });
    
    if (!game || game.players.length < 2) {
      return res.status(400).json({ error: 'Not enough players' });
    }
    
    game.status = 'active';
    game.startTime = new Date();
    await game.save();
    
    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start game' });
  }
});

module.exports = router;