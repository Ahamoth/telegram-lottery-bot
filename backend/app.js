require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// CORS настройка для фронтенда
const corsOptions = {
  origin: [
    'https://telegram-lottery-bot.netlify.app',
    'https://web.telegram.org',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://telegram-lottery-bot-e75s.onrender.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://telegramlottery_user:3WYlxQ5jwHMCEUYQIF2r6S3g0sHhFFL3@dpg-d4eahs6mcj7s73cj3b8g-a/telegramlottery',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Инициализация базы данных
const initDB = async () => {
  try {
    // Создаем таблицу пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        balance INTEGER DEFAULT 1000,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_winnings INTEGER DEFAULT 0,
        avatar VARCHAR(50) DEFAULT '👤',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем таблицу игр
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) DEFAULT 'waiting',
        bank_amount INTEGER DEFAULT 0,
        winning_center INTEGER,
        winning_left INTEGER,
        winning_right INTEGER,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем таблицу игроков (обновлена для аватаров)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_players (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id),
        telegram_id VARCHAR(255),
        player_number INTEGER,
        player_name VARCHAR(255),
        avatar VARCHAR(50) DEFAULT '👤',
        is_bot BOOLEAN DEFAULT false,
        UNIQUE(game_id, player_number)
      )
    `);

    // Создаем таблицу победителей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS winners (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id),
        telegram_id VARCHAR(255),
        prize INTEGER,
        prize_type VARCHAR(50),
        player_number INTEGER,
        avatar VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ 
      status: 'OK', 
      message: 'Server is running',
      database: 'PostgreSQL connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(200).json({ 
      status: 'OK', 
      message: 'Server is running',
      database: 'PostgreSQL disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', require('./routes/auth')(pool));
app.use('/api/game', require('./routes/game')(pool));
app.use('/api/user', require('./routes/user')(pool));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Demo endpoint
app.get('/demo', (req, res) => {
  res.json({
    message: 'Server is running with PostgreSQL!',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

// Start bot
if (process.env.NODE_ENV === 'production' && process.env.BOT_TOKEN) {
  try {
    const bot = require('./bot/bot');
    console.log('🤖 Telegram bot started');
  } catch (error) {
    console.log('⚠️  Bot not started:', error.message);
  }
} else {
  console.log('🤖 Bot token not provided, running in API-only mode');
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const PORT = process.env.PORT || 10000;

// Инициализация и запуск
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database: PostgreSQL`);
    console.log(`🔗 Health: https://telegram-lottery-bot-e75s.onrender.com/health`);
    console.log(`🎯 Frontend: https://telegram-lottery-bot.netlify.app`);
  });
});
