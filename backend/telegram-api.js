const axios = require('axios');

class TelegramAPI {
  constructor(botToken) {
    this.botToken = botToken;
    this.baseURL = `https://api.telegram.org/bot${botToken}`;
  }

  // Метод для перевода Stars через Telegram Bot API
  async transferStars(userId, amount) {
    try {
      console.log(`🔄 Перевод ${amount} Stars пользователю ${userId}`);
      
      const response = await axios.post(`${this.baseURL}/transferStars`, {
        user_id: parseInt(userId),
        amount: parseInt(amount)
      });

      console.log('✅ Stars переведены успешно:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка перевода Stars:', error.response?.data || error.message);
      throw error;
    }
  }

  // Проверка доступности метода transferStars
  async checkTransferAvailability() {
    try {
      const response = await axios.get(`${this.baseURL}/getMe`);
      console.log('🤖 Информация о боте:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Бот не доступен:', error.message);
      return false;
    }
  }
}

module.exports = TelegramAPI;
