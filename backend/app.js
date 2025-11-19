// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// CORS
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

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20
});

// Тест подключения
pool.connect((err) => {
  if (err) console.error('Database connection error:', err.stack);
  else console.log('PostgreSQL connected successfully');
});

// ==================================================================
// ИНИЦИАЛИЗАЦИЯ И МИГРАЦИИ БАЗЫ
// ==================================================================
const initDB = async () => {
  try {
    console.log('Запуск миграций базы данных...');

    // 1. users
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
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. games
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
      );
    `);

    // 3. game_players
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_players (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        telegram_id VARCHAR(255),
        player_number INTEGER,
        player_name VARCHAR(255),
        avatar TEXT,
        is_bot BOOLEAN DEFAULT false,
        UNIQUE(game_id, player_number)
      );
    `);

    // 4. winners
    await pool.query(`
      CREATE TABLE IF NOT EXISTS winners (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        telegram_id VARCHAR(255),
        prize INTEGER,
        prize_type VARCHAR(50),
        player_number INTEGER,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. transactions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        provider_payment_charge_id VARCHAR(255),
        telegram_payment_charge_id VARCHAR(255),
        invoice_payload TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Миграции
    try {
      await pool.query(`ALTER TABLE users ALTER COLUMN avatar TYPE TEXT USING avatar::TEXT;`);
    } catch (e) {}
    
    try {
      await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS invoice_payload TEXT;`);
    } catch (e) {}
    
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_payload ON transactions(invoice_payload);`);
    } catch (e) {}

    console.log('Все таблицы и миграции выполнены успешно ✅');
  } catch (err) {
    console.error('Ошибка миграции:', err.message);
  }
};

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      database: 'connected', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', database: 'disconnected' });
  }
});

// Загружаем бота
let bot = null;
if (process.env.BOT_TOKEN) {
  try {
    console.log('Загрузка бота...');
    bot = require('./bot/bot')(pool);
    bot.telegram.getMe().then(info => console.log(`Bot @${info.username} готов`));
  } catch (e) {
    console.error('Ошибка загрузки бота:', e.message);
  }
} else {
  console.log('BOT_TOKEN не найден, бот не запускается');
}

// Роуты (ВАЖНО: передаем bot в auth)
app.use('/api/auth', require('./routes/auth')(pool, bot)); // ← исправлено
app.use('/api/game', require('./routes/game')(pool));
app.use('/api/user', require('./routes/user')(pool));
app.use('/api/payment', require('./routes/payment')(pool, bot));

// Главная
app.get('/', (req, res) => {
  res.json({
    message: 'Telegram Lottery API v1.0',
    stars_payments: !!bot ? 'ENABLED' : 'DISABLED',
    bot_ready: !!bot,
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Глобальная ошибка
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Server error: ' + err.message 
  });
});

const PORT = process.env.PORT || 10000;

const startServer = async () => {
  await initDB();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Stars Payments: ${bot ? 'ВКЛЮЧЕНЫ ✅' : 'ВЫКЛЮЧЕНЫ ❌'}`);
    console.log(`Режим: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();
