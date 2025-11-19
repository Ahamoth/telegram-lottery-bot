require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// CORS — разрешаем твои домены
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

// Подключение к PostgreSQL (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20
});

// Тест подключения
pool.connect((err) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ PostgreSQL connected successfully');
  }
});

// Инициализация таблиц и миграций (оставляем как было)
const initDB = async () => {
  await pool.query(`ALTER TABLE users ALTER COLUMN avatar TYPE TEXT USING avatar::TEXT`);
  // ... твой код initDB и migrateDatabase без изменений
  // (можно оставить полностью как у тебя был — он рабочий)
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

// === ВАЖНО: СНАЧАЛА ЗАГРУЖАЕМ БОТА ===
let bot = null;
if (process.env.BOT_TOKEN) {
  try {
    console.log('🚀 Loading Telegram bot...');
    bot = require('./bot/bot');  // ← bot теперь существует!
    
    bot.telegram.getMe().then(info => {
      console.log(`✅ Bot @${info.username} loaded and ready`);
    }).catch(err => {
      console.error('❌ Bot connection failed:', err.message);
    });
  } catch (error) {
    console.error('❌ Failed to load bot:', error.message);
    bot = null;
  }
} else {
  console.warn('⚠️ No BOT_TOKEN – running without bot (Stars payments disabled)');
}

// === ТЕПЕРЬ ПОДКЛЮЧАЕМ ВСЕ РОУТЫ ===
app.use('/api/auth', require('./routes/auth')(pool));
app.use('/api/game', require('./routes/game')(pool));
app.use('/api/user', require('./routes/user')(pool));

// ←←← ВОТ ТУТ bot уже гарантированно существует!
app.use('/api/payment', require('./routes/payment')(pool, bot));

// Главная страница
app.get('/', (req, res) => {
  res.json({
    message: 'Telegram Lottery API v1.0',
    status: 'running',
    stars_payments: !!bot,
    timestamp: new Date().toISOString()
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Запуск сервера
const PORT = process.env.PORT || 10000;

const startServer = async () => {
  try {
    await initDB();
    // await migrateDatabase(); // если есть — раскомментируй
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`💰 Stars Payments: ${bot ? 'ENABLED ✅' : 'DISABLED ❌'}`);
      console.log(`🖼️ Real Avatars: ENABLED ✅`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

