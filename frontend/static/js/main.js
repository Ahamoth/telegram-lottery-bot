const { useState, useEffect, useRef } = React;

// API service
const API = {
  baseUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://telegram-lottery-bot-e75s.onrender.com',
  
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  async authenticate(initData) { return this.request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) }); },
  async getCurrentGame() { return this.request('/game/current'); },
  async joinGame(userData) { return this.request('/game/join', { method: 'POST', body: JSON.stringify(userData) }); },
  async leaveGame(telegramId) { return this.request('/game/leave', { method: 'POST', body: JSON.stringify({ telegramId }) }); },
  async getUserProfile(telegramId) { return this.request(`/user/profile/${telegramId}`); },

  // Пополнение
  async createStarsInvoiceLink(telegramId, amount) {
    return this.request('/payment/create-invoice-link', { method: 'POST', body: JSON.stringify({ telegramId, amount }) });
  },

  // ВЫВОД НА TON SPACE
  async withdrawToTonSpace(telegramId, amount) {
    return this.request('/payment/withdraw-to-tonspace', { method: 'POST', body: JSON.stringify({ telegramId, amount }) });
  },

  async demoPayment(telegramId, amount) { return this.request('/payment/demo-payment', { method: 'POST', body: JSON.stringify({ telegramId, amount }) }); },
  async getPaymentHistory(telegramId, limit = 10) { return this.request(`/payment/history/${telegramId}?limit=${limit}`); }
};

// Аватар
const UserAvatar = ({ avatar, name = '', size = 'normal' }) => {
  const sizes = { large: '56px', normal: '40px', small: '32px' };
  const fontSizes = { large: '22px', normal: '16px', small: '13px' };

  if (avatar && avatar.startsWith('https://') && !avatar.includes('.svg')) {
    return React.createElement('img', {
      src: avatar,
      alt: name,
      style: { width: sizes[size], height: sizes[size], borderRadius: '50%', objectFit: 'cover', border: '3px solid #ffd700', boxShadow: '0 0 15px rgba(255,215,0,0.5)' },
      loading: 'lazy'
    });
  }

  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : '??';

  return React.createElement('div', {
    style: {
      width: sizes[size],
      height: sizes[size],
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: fontSizes[size],
      border: '3px solid #ffd700',
      boxShadow: '0 0 15px rgba(255,215,0,0.5)'
    }
  }, initials);
};

// Профиль с пополнением и выводом
const Profile = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ gamesPlayed: 0, gamesWon: 0, totalWinnings: 0 });
  const [loading, setLoading] = useState(false);

  const loadUserData = async () => {
    if (!window.Telegram?.WebApp?.initDataUnsafe?.user) return;
    const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    try {
      const profile = await API.getUserProfile(tgUser.id);
      if (profile.success) {
        setUser(profile.user);
        setStats({
          gamesPlayed: profile.user.gamesPlayed || 0,
          gamesWon: profile.user.gamesWon || 0,
          totalWinnings: profile.user.totalWinnings || 0
        });
      }
    } catch (err) { console.error('Load profile error:', err); }
  };

  useEffect(() => {
    loadUserData();
    const interval = setInterval(loadUserData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleTelegramPayment = async (amount) => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await API.createStarsInvoiceLink(user.telegramId, amount);
      if (result.success && result.invoice_link) {
        window.location.href = result.invoice_link;
      }
    } catch (error) {
      alert('Ошибка оплаты');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (loading || !user || user.balance < 10) return;
    if (!confirm(`Вывести ${user.balance} ⭐ на твой Telegram Wallet (TON Space)?`)) return;

    setLoading(true);
    try {
      const res = await API.withdrawToTonSpace(user.telegramId, user.balance);
      alert(res.success ? res.message : res.error || 'Ошибка вывода');
      if (res.success) loadUserData();
    } catch (e) {
      alert('Ошибка вывода');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return React.createElement('div', { className: 'loading' }, 'Загрузка...');

  return React.createElement('div', { className: 'profile' },
    React.createElement('div', { className: 'profile-header' },
      React.createElement(UserAvatar, { avatar: user.avatar, name: user.firstName || user.username, size: 'large' }),
      React.createElement('h1', null, user.firstName || user.username),
      React.createElement('p', null, `ID: ${user.telegramId}`)
    ),

    React.createElement('div', { className: 'stats-grid' },
      React.createElement('div', { className: 'stat-card' }, React.createElement('h3', null, 'Сыграно'), React.createElement('div', { className: 'stat-value' }, stats.gamesPlayed)),
      React.createElement('div', { className: 'stat-card' }, React.createElement('h3', null, 'Победы'), React.createElement('div', { className: 'stat-value' }, stats.gamesWon)),
      React.createElement('div', { className: 'stat-card' }, React.createElement('h3', null, 'Выиграно'), React.createElement('div', { className: 'stat-value' }, `${stats.totalWinnings}⭐`)),
      React.createElement('div', { className: 'stat-card' }, React.createElement('h3', null, 'Процент'), React.createElement('div', { className: 'stat-value' }, stats.gamesPlayed > 0 ? `${((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(0)}%` : '0%'))
    ),

    React.createElement('div', { className: 'balance-display' },
      React.createElement('h2', null, 'Баланс'),
      React.createElement('div', { className: 'balance-value' }, `${user.balance} ⭐`)
    ),

    // Пополнение
    React.createElement('div', { className: 'profile-actions' },
      React.createElement('h2', null, 'Пополнить'),
      React.createElement('div', { className: 'action-buttons' },
        [10, 50, 100, 500].map(a => 
          React.createElement('button', { 
            key: a,
            className: 'control-button primary',
            onClick: () => handleTelegramPayment(a),
            disabled: loading
          }, loading ? '...' : `${a} ⭐`)
        )
      )
    ),

    // ВЫВОД НА TON SPACE
    React.createElement('div', { className: 'profile-actions', style: { marginTop: '2rem' } },
      React.createElement('h2', null, 'Вывод на TON Space'),
      React.createElement('button', {
        className: 'control-button success',
        disabled: loading || user.balance < 10,
        onClick: handleWithdraw,
        style: { width: '100%', padding: '1rem', fontSize: '1.1rem' }
      }, loading ? 'Вывод...' : `Вывести ${user.balance} ⭐ → Telegram Wallet`)
    )
  );
};

// Остальные компоненты (Header, Game, Home, App) оставь как у тебя были

// App и рендер без изменений
const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(window.location.hash.replace('#', '') || 'home');
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    setIsInitialized(true);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderPage = () => {
    if (!isInitialized) return React.createElement('div', { className: 'loading' }, 'Загрузка...');
    switch(currentPage) {
      case 'game': return React.createElement(Game);
      case 'profile': return React.createElement(Profile);
      default: return React.createElement(Home);
    }
  };

  return React.createElement('div', { className: 'App' },
    React.createElement(Header),
    React.createElement('main', null, renderPage())
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('App Error:', error, info); }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { className: 'loading' },
        React.createElement('h1', null, 'Ошибка'),
        React.createElement('button', { onClick: () => window.location.reload(), className: 'control-button primary' }, 'Обновить')
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(ErrorBoundary, null, React.createElement(App)));
