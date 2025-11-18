const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['game_entry', 'prize_win', 'balance_topup', 'withdrawal'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: String,
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
