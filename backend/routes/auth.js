const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Простая аутентификация для демо
router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    
    // Упрощенная валидация для демо
    let userData;
    try {
      if (initData && initData.user) {
        userData = JSON.parse(decodeURIComponent(initData.user));
      } else {
        // Демо пользователь
        userData = {
          id: Math.random().toString(36).substr(2, 9),
          first_name: 'Demo',
          last_name: 'User',
          username: 'demo_user'
        };
      }
    } catch (error) {
      userData = {
        id: Math.random().toString(36).substr(2, 9),
        first_name: 'Demo',
        last_name: 'User', 
        username: 'demo_user'
      };
    }

    let user = await User.findOne({ telegramId: userData.id.toString() });
    
    if (!user) {
      user = new User({
        telegramId: userData.id.toString(),
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username,
        balance: 1000
      });
      await user.save();
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
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
