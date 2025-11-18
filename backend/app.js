require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// CORS настройка
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
  connectionString: process.env.DATABASE_URL,
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
        balance INTEGER DEFAULT 0,
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

    // Создаем таблицу игроков
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

    // Создаем таблицу транзакций для пополнений
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        provider_payment_charge_id VARCHAR(255),
        telegram_payment_charge_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      mode: 'PRODUCTION',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Server is running',
      database: 'PostgreSQL disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes - ИСПРАВЛЕННЫЕ ПУТИ
app.use('/api/auth', require('./routes/auth')(pool));
app.use('/api/game', require('./routes/game')(pool));
app.use('/api/user', require('./routes/user')(pool));
app.use('/api/payment', require('./routes/payment')(pool));

// Serve frontend
app.get('/', (req, res) => {
  res.json({ 
    message: 'Telegram Lottery API', 
    version: '1.0.0',
    status: 'running'
  });
});

// Start bot
if (process.env.NODE_ENV === 'production' && process.env.BOT_TOKEN) {
  try {
    const bot = require('./bot/bot');
    console.log('🤖 Telegram bot started');
  } catch (error) {
    console.log('❌ Bot failed to start:', error.message);
  }
} else {
  console.log('❌ Bot token not provided');
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
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`🗄️ Database: PostgreSQL`);
    console.log(`💰 Mode: REAL MONEY (Telegram Stars)`);
    console.log(`🔗 Health: https://telegram-lottery-bot-e75s.onrender.com/health`);
  });
  / Функция для миграции базы данных
const migrateDatabase = async () => {
  try {
    console.log('🔄 Checking database migrations...');
    
    // Проверяем существование колонки avatar в таблице users
    const checkAvatarColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'avatar'
    `);
    
    if (checkAvatarColumn.rows.length === 0) {
      console.log('📝 Adding avatar column to users table...');
      await pool.query(`
        ALTER TABLE users ADD COLUMN avatar VARCHAR(50) DEFAULT '👤'
      `);
      console.log('✅ Avatar column added successfully');
    } else {
      console.log('✅ Avatar column already exists');
    }
    
    // Проверяем другие возможные отсутствующие колонки
    const columnsToCheck = [
      { table: 'users', column: 'games_played', type: 'INTEGER DEFAULT 0' },
      { table: 'users', column: 'games_won', type: 'INTEGER DEFAULT 0' },
      { table: 'users', column: 'total_winnings', type: 'INTEGER DEFAULT 0' }
    ];
    
    for (const { table, column, type } of columnsToCheck) {
      const checkColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);
      
      if (checkColumn.rows.length === 0) {
        console.log(`📝 Adding ${column} column to ${table} table...`);
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`✅ ${column} column added to ${table}`);
      }
    }
    
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Database migration error:', error);
  }
};
});

