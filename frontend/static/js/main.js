const { useState, useEffect } = React;

// API сервис
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
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return await response.json();
    } catch (err) {
      console.error('API error:', err);
      throw err;
    }
  },

  authenticate(initData) { return this.request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) }); },
  getCurrentGame() { return this.request('/game/current'); },
  joinGame(data) { return this.request('/game/join', { method: 'POST', body: JSON.stringify(data) }); },
  leaveGame(telegramId) { return this.request('/game/leave', { method: 'POST', body: JSON.stringify({ telegramId }) }); },
  getUserProfile(id) { return this.request(`/user/profile/${id}`); },
  createStarsInvoiceLink(telegramId, amount) { return this.request('/payment/create-invoice-link', { method: 'POST', body: JSON.stringify({ telegramId, amount }) }); },
  withdrawToTonSpace(telegramId, amount) { return this.request('/payment/withdraw-to-tonspace', { method: 'POST', body: JSON.stringify({ telegramId, amount }) }); },
  demoPayment(telegramId, amount) { return this.request('/payment/demo-payment', { method: 'POST', body: JSON.stringify({ telegramId, amount }) }); }
};

// Аватар
const UserAvatar = ({ avatar, name = '', size = 'normal' }) => {
  const sizes = { large: '56px', normal: '40px', small: '32px' };
  const isSvg = avatar && (avatar.includes('.svg') || avatar.includes('/userpic/'));

  if (avatar && !isSvg && avatar.startsWith('https://')) {
    return React.createElement('img', {
      src: avatar,
      alt: name,
      style: {
        width: sizes[size],
        height: sizes[size],
        borderRadius: '50%',
        objectFit: 'cover',
        border: '3px solid #ffd700',
        boxShadow: '0 0 15px rgba(255,215,0,0.5)'
      },
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
      fontSize: size === 'large' ? '22px' : '16px',
      border: '3px solid #ffd700',
      boxShadow: '0 0 15px rgba(255,215,0,0.5)'
    }
  }, initials);
};

// Хедер с навигацией
const Header = () => {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    const init = async () => {
      if (!window.Telegram?.WebApp?.initData) return;
      try {
        const res = await API.authenticate(window.Telegram.WebApp.initData);
        if (res.success) setUser(res.user);
      } catch (err) {}
    };
    init();

    const hashHandler = () => setCurrentPage(window.location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', hashHandler);
    hashHandler();

    return () => window.removeEventListener('hashchange', hashHandler);
  }, []);

  const navigate = (page) => {
    window.location.hash = page;
  };

  return React.createElement('header', { className: 'header' },
    React.createElement('div', { className: 'top-bar' },
      user && React.createElement(UserAvatar, { avatar: user.avatar, name: user.firstName || user.username, size: 'large' }),
      React.createElement('div', { className: 'user-info' },
        React.createElement('div', { className: 'user-name' }, user?.firstName || 'Игрок'),
        React.createElement('div', { className: 'user-balance' }, user ? `${user.balance} ⭐` : '0 ⭐')
      )
    ),

    // Навигация
    React.createElement('nav', { className: 'bottom-nav' },
      React.createElement('button', {
        className: `nav-btn ${currentPage === 'home' ? 'active' : ''}`,
        onClick: () => navigate('home')
      }, 'Главная'),
      React.createElement('button', {
        className: `nav-btn ${currentPage === 'game' ? 'active' : ''}`,
        onClick: () => navigate('game')
      }, 'Играть'),
      React.createElement('button', {
        className: `nav-btn ${currentPage === 'profile' ? 'active' : ''}`,
        onClick: () => navigate('profile')
      }, 'Профиль')
    )
  );
};

// Профиль с выводом
const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadUser = async () => {
    const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    if (!tgUser) return;
    try {
      const res = await API.getUserProfile(tgUser.id);
      if (res.success) setUser(res.user);
    } catch (err) {}
  };

  useEffect(() => {
    loadUser();
    const i = setInterval(loadUser, 8000);
    return () => clearInterval(i);
  }, []);

  const handlePayment = async (amount) => {
    setLoading(true);
    try {
      const res = await API.createStarsInvoiceLink(user.telegramId, amount);
      if (res.success) window.location.href = res.invoice_link;
    } catch (err) {
      alert('Ошибка оплаты');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (user.balance < 10) return alert('Минимум 10 ⭐');
    if (!confirm(`Вывести ${user.balance} ⭐ на TON Space?`)) return;

    setLoading(true);
    try {
      const res = await API.withdrawToTonSpace(user.telegramId, user.balance);
      alert(res.success ? res.message : res.error);
      if (res.success) loadUser();
    } catch (err) {
      alert('Вывод недоступен');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return React.createElement('div', { className: 'loading' }, 'Загрузка...');

  return React.createElement('div', { className: 'profile' },
    React.createElement(UserAvatar, { avatar: user.avatar, name: user.firstName, size: 'large' }),
    React.createElement('h1', null, user.firstName || 'Игрок'),
    React.createElement('div', { className: 'balance-display' },
      React.createElement('h2', null, 'Баланс'),
      React.createElement('div', { className: 'balance-value' }, `${user.balance} ⭐`)
    ),

    React.createElement('div', { className: 'profile-actions' },
      React.createElement('h2', null, 'Пополнить'),
      React.createElement('div', { className: 'action-buttons' },
        [10, 50, 100, 500].map(a => 
          React.createElement('button', {
            key: a,
            className: 'control-button primary',
            onClick: () => handlePayment(a),
            disabled: loading
          }, `${a} ⭐`)
        )
      )
    ),

    React.createElement('div', { className: 'profile-actions', style: { marginTop: '2rem' } },
      React.createElement('h2', null, 'Вывод на TON Space'),
      React.createElement('button', {
        className: 'control-button success',
        disabled: loading || user.balance < 10,
,
        onClick: handleWithdraw
      }, `Вывести ${user.balance} ⭐ → TON Space`)
    )
  );
};

// Заглушки для страниц
const Home = () => React.createElement('div', { className: 'page' }, 
  React.createElement('h1', null, 'Главная'),
  React.createElement('p', null, 'Добро пожаловать в лотерею!')
);

const Game = () => React.createElement('div', { className: 'page' }, 
  React.createElement('h1', null, 'Игра'),
  React.createElement('p', null, 'Тут будет игровое поле')
);

// App
const App = () => {
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      Telegram.WebApp.ready();
      Telegram.WebApp.expand();
      Telegram.WebApp.setHeaderColor('#1a1a2e');
      Telegram.WebApp.setBackgroundColor('#0f0f1a');
    }
  }, []);

  return React.createElement('div', { className: 'App' },
    React.createElement(Header),
    React.createElement('main', null,
      window.location.hash === '#profile' ? React.createElement(Profile) :
      window.location.hash === '#game' ? React.createElement(Game) :
      React.createElement(Home)
    )
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
