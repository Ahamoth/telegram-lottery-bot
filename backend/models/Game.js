const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  players: [{
    telegramId: String,
    number: Number,
    name: String,
    avatar: String,
    isBot: Boolean
  }],
  winningNumbers: {
    center: Number,
    left: Number,
    right: Number
  },
  winners: [{
    telegramId: String,
    prize: Number,
    type: String,
    number: Number
  }],
  bankAmount: Number,
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting'
  },
  startTime: Date,
  endTime: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Game', gameSchema);