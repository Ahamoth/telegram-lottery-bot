require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// CORS настройка для Render
const corsOptions = {
  origin: [
    'https://telegram-lottery-bot.netlify.app',  // ваш Netlify URL
    'https://web.telegram.org',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from frontend (для полнофункционального режима)
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-lottery';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));
app.use('/api/user', require('./routes/user'));

// Serve frontend for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Telegram Mini App validation endpoint
app.get('/tg-auth', (req, res) => {
  const { initData } = req.query;
  // Здесь будет валидация данных Telegram
  res.json({ 
    success: true, 
    message: 'Telegram auth endpoint',
    timestamp: new Date().toISOString()
  });
});

// Start Telegram bot (только в production)
if (process.env.NODE_ENV === 'production' && process.env.BOT_TOKEN) {
  const bot = require('./bot/bot');
  console.log('🤖 Telegram bot started');
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 MongoDB: ${MONGODB_URI.includes('localhost') ? 'Local' : 'Cloud'}`);
});
