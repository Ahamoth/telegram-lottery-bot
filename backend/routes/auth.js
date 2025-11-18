const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const router = express.Router();

// Validate Telegram Web App data (simplified for demo)
function validateTelegramData(initData) {
  try {
    // For production, implement proper Telegram validation
    // For demo purposes, we'll accept all requests
    return true;
  } catch (error) {
    return false;
  }
}

router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    
    // For demo, we'll create a user even without validation
    let userData;
    
    if (initData) {
      try {
        const params = new URLSearchParams(initData);
        const userParam = params.get('user');
        if (userParam) {
          userData = JSON.parse(decodeURIComponent(userParam));
        }
      } catch (error) {
        console.log('Failed to parse initData, using demo user');
      }
    }
    
    if (!userData) {
      // Create demo user data
      userData = {
        id: Math.random().toString(36).substr(2, 9),
        first_name: 'Demo',
        last_name: 'User',
        username: 'demo_user_' + Math.random().toString(36).substr(2, 5)
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
      console.log('New user created:', user.telegramId);
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

// Demo auth endpoint for development
router.post('/demo', async (req, res) => {
  try {
    const { username } = req.body;
    
    const demoUser = {
      telegramId: 'demo-' + Math.random().toString(36).substr(2, 9),
      firstName: username || 'Demo',
      lastName: 'User',
      username: username || 'demo_user',
      balance: 1000
    };
    
    let user = await User.findOne({ telegramId: demoUser.telegramId });
    
    if (!user) {
      user = new User(demoUser);
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
    console.error('Demo auth error:', error);
    res.status(500).json({ error: 'Demo authentication failed' });
  }
});

module.exports = router;
