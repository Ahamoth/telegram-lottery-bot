const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const router = express.Router();

// Validate Telegram Web App data
function validateTelegramData(initData) {
  // Simplified validation - in production use proper Telegram validation
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    
    // Sort parameters alphabetically
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Validate using your bot token (simplified)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    return false;
  }
}

router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!validateTelegramData(initData)) {
      return res.status(401).json({ error: 'Invalid Telegram data' });
    }
    
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user'));
    
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
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        totalWinnings: user.totalWinnings
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;