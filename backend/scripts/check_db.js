const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection and structure...');
    
    // Проверяем подключение
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Проверяем таблицу users
    const usersTable = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    console.log('📊 Users table columns:');
    usersTable.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Проверяем есть ли столбец avatar
    const hasAvatar = usersTable.rows.some(col => col.column_name === 'avatar');
    console.log(hasAvatar ? '✅ Avatar column exists' : '❌ Avatar column missing');
    
    // Проверяем существующих пользователей
    const users = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`👥 Total users in database: ${users.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  }
}

checkDatabase();