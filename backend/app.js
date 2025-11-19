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
// ВСЯ ИНИЦИАЛИЗАЦИЯ И МИГРАЦИИ БАЗЫ — ОДНИМ БЛОКОМ
// ==================================================================
const initDB = async () => {
  try {
    console.log('Запуск миграций базы данных...');

    // 1. Таблица users (сразу с правильным avatar)
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
      )
    `);

    // 2. Таблица transactions — добавляем invoice_payload если нет
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
      )
    `);

    // 3. Остальные таблицы (games, game_players, winners) — оставь как у тебя было
    await pool.query(`CREATE TABLE IF NOT EXISTS games ( ... твоя таблица ... )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS game_players ( ... )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS winners ( ... )`);

    // 4. Миграции: расширяем avatar и добавляем invoice_payload (безопасно)
    await pool.query(`ALTER TABLE users ALTER COLUMN avatar TYPE TEXT USING avatar::TEXT;`);
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS invoice_payload TEXT;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_payload ON transactions(invoice_payload);`);

    console.log('Все миграции выполнены успешно: avatar TEXT + invoice_payload готово');
  } catch (err) {
    console.error('Ошибка миграции:', err.message);
  }
};

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', database: 'disconnected' });
  }
});

// Загружаем бота (передаём pool!)
let bot = null;
if (process.env.BOT_TOKEN) {
  try {
    console.log('Загрузка бота...');
    bot = require('./bot/bot')(pool);  // ← pool передаётся!
    bot.telegram.getMe().then(info => console.log(`Bot @${info.username} готов`));
  } catch (e) {
    console.error('Ошибка загрузки бота:', e.message);
  }
}

// Роуты
app.use('/api/auth', require('./routes/auth')(pool));
app.use('/api/game', require('./routes/game')(pool));
app.use('/api/user', require('./routes/user')(pool));
app.use('/api/payment', require('./routes/payment')(pool, bot));

// Главная
app.get('/', (req, res) => {
  res.json({
    message: 'Telegram Lottery API v1.0',
    stars_payments: !!bot ? 'ENABLED' : 'DISABLED',
    real_avatars: 'ENABLED',
    timestamp: new Date().toISOString()
  });
});

// Глобальная ошибка
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ success: false, error: 'Server error' });
});

const PORT = process.env.PORT || 10000;

const startServer = async () => {
  await initDB();  // ← Все миграции здесь

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Stars Payments: ${bot ? 'ВКЛЮЧЕНЫ ✅' : 'ВЫКЛЮЧЕНЫ ❌'}`);
    console.log(`Реальные аватары: ВКЛЮЧЕНЫ ✅`);
  });
};

startServer();
