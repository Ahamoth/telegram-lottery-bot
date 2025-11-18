const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Get user profile
router.get('/profile/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        balance: user.balance,
        gamesPlayed: user.gamesPlayed || 0,
        gamesWon: user.gamesWon || 0,
        totalWinnings: user.totalWinnings || 0
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user balance
router.post('/balance', async (req, res) => {
  try {
    const { telegramId, amount } = req.body;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.balance += amount;
    await user.save();
    
    res.json({
      success: true,
      newBalance: user.balance,
      message: `Balance updated by ${amount}`
    });
  } catch (error) {
    console.error('Balance update error:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Get user stats
router.get('/stats/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const winRate = user.gamesPlayed > 0 
      ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1)
      : 0;
    
    res.json({
      success: true,
      stats: {
        gamesPlayed: user.gamesPlayed || 0,
        gamesWon: user.gamesWon || 0,
        totalWinnings: user.totalWinnings || 0,
        winRate: winRate,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
