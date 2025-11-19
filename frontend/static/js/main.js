const { useState, useEffect } = React;

// API сервис
const API = {
  baseUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://telegram-lottery-api-production.up.railway.app',

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}/api${endpoint}`;
      console.log(`🔄 API Request: ${url}`, options);
      
      const response = await fetch(url, {
        headers: { 
          'Content-Type': 'application/json', 
          ...options.headers 
        },
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ API Response:`, data);
      return data;
    } catch (err) {
      console.error('❌ API request failed:', err);
      throw err;
    }
  },

  // Аутентификация
  authenticate(initData) { 
    return this.request('/auth/telegram', { 
      method: 'POST', 
      body: JSON.stringify({ initData }) 
    }); 
  },
  
  // Игра
  getCurrentGame() { 
    return this.request('/game/current'); 
  },
  
  joinGame(data) { 
    return this.request('/game/join', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }); 
  },
  
  leaveGame(telegramId) { 
    return this.request('/game/leave', { 
      method: 'POST', 
      body: JSON.stringify({ telegramId }) 
    }); 
  },
  
  startGame() { 
    return this.request('/game/start', { 
      method: 'POST', 
      body: JSON.stringify({}) 
    }); 
  },
  
  finishGame(gameId, winningNumbers) { 
    return this.request('/game/finish', { 
      method: 'POST', 
      body: JSON.stringify({ gameId, winningNumbers }) 
    }); 
  },

  // Пользователь
  getCurrentUser(telegramId) { 
    return this.request(`/user/current?telegramId=${telegramId}`); 
  },

  // Платежи
  createStarsInvoiceLink(telegramId, amount) { 
    return this.request('/payment/create-invoice-link', { 
      method: 'POST', 
      body: JSON.stringify({ telegramId, amount }) 
    }); 
  },
  
  withdrawToTonSpace(telegramId, amount) { 
    return this.request('/payment/withdraw-to-tonspace', { 
      method: 'POST', 
      body: JSON.stringify({ telegramId, amount }) 
    }); 
  },
  
  withdrawViaInvoice(telegramId, amount) { 
    return this.request('/payment/withdraw-via-invoice', { 
      method: 'POST', 
      body: JSON.stringify({ telegramId, amount }) 
    }); 
  },
  
  getWithdrawStatus(telegramId) { 
    return this.request(`/payment/withdraw-status/${telegramId}`); 
  },
  
  demoPayment(telegramId, amount) { 
    return this.request('/payment/demo-payment', { 
      method: 'POST', 
      body: JSON.stringify({ telegramId, amount }) 
    }); 
  }
};

// Аватар компонент
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

// Header Component - ИСПРАВЛЕННАЯ ВЕРСИЯ
const Header = () => {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');

  // Функция для безопасного получения текущей страницы из хеша
  const getCurrentPageFromHash = () => {
    const hash = window.location.hash;
    console.log('Current hash:', hash);
    
    // Если хеш пустой или содержит только #, возвращаем home
    if (!hash || hash === '#' || hash === '#/') {
      return 'home';
    }
    
    // Пытаемся извлечь имя страницы из хеша
    const match = hash.match(/^#\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Если хеш содержит tgWebAppData, это начальная загрузка
    if (hash.includes('tgWebAppData')) {
      return 'home';
    }
    
    // По умолчанию возвращаем home
    return 'home';
  };

  // Функция для получения реальных данных пользователя из Telegram
  const getTelegramUserData = () => {
    try {
      // Способ 1: Через Telegram WebApp
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        console.log('📱 Telegram WebApp user data:', tgUser);
        return {
          telegramId: tgUser.id?.toString(),
          firstName: tgUser.first_name || 'Игрок',
          lastName: tgUser.last_name || '',
          username: tgUser.username || '',
          avatar: tgUser.photo_url || null
        };
      }

      // Способ 2: Через initData строку
      if (window.Telegram?.WebApp?.initData) {
        const params = new URLSearchParams(window.Telegram.WebApp.initData);
        const userJson = params.get('user');
        if (userJson) {
          const tgUser = JSON.parse(userJson);
          console.log('📱 Telegram initData user:', tgUser);
          return {
            telegramId: tgUser.id?.toString(),
            firstName: tgUser.first_name || 'Игрок',
            lastName: tgUser.last_name || '',
            username: tgUser.username || '',
            avatar: tgUser.photo_url || null
          };
        }
      }

      // Способ 3: Демо-режим (только для разработки)
      console.warn('⚠️ Telegram data not found, using demo mode');
      return {
        telegramId: 'demo-user',
        firstName: 'Demo User',
        username: 'demo',
        avatar: null
      };

    } catch (error) {
      console.error('Error getting Telegram user data:', error);
      return null;
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Получаем данные пользователя из Telegram
        const tgUserData = getTelegramUserData();
        if (!tgUserData) {
          console.log('No Telegram user data found');
          return;
        }

        console.log('Loading user data for:', tgUserData.telegramId);
        
        // Сначала пробуем аутентификацию
        try {
          if (window.Telegram?.WebApp?.initData) {
            const authRes = await API.authenticate(window.Telegram.WebApp.initData);
            if (authRes.success) {
              setUser(authRes.user);
              console.log('User loaded from auth:', authRes.user);
              return;
            }
          }
        } catch (authErr) {
          console.log('Auth failed, trying direct profile:', authErr);
        }
        
        // Если аутентификация не сработала, пробуем напрямую профиль
        try {
          const res = await API.getCurrentUser(tgUserData.telegramId);
          if (res.success) {
            setUser(res.user);
            console.log('User loaded from profile:', res.user);
          } else {
            console.log('Failed to load user profile, using Telegram data');
            // Используем данные из Telegram как временные
            setUser({
              ...tgUserData,
              balance: 0,
              gamesPlayed: 0,
              gamesWon: 0,
              totalWinnings: 0
            });
          }
        } catch (profileErr) {
          console.log('Profile load error, using Telegram data:', profileErr);
          // Используем данные из Telegram как временные
          setUser({
            ...tgUserData,
            balance: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            totalWinnings: 0
          });
        }
      } catch (err) {
        console.log('User load error:', err);
      }
    };

    loadUser();

    // Функция для обработки изменения хеша
    const handleHashChange = () => {
      const page = getCurrentPageFromHash();
      setCurrentPage(page);
      console.log('Page changed to:', page);
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Устанавливаем начальную страницу
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigate = (page) => {
    console.log('Navigating to:', page);
    // Используем чистый хеш без параметров
    window.location.hash = `/${page}`;
  };

  return React.createElement('header', { 
    className: 'header',
    style: { 
      background: 'var(--bg-dark)',
      padding: '0',
      boxShadow: 'var(--shadow)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }
  },
    // Верхняя часть с аватаром и балансом
    React.createElement('div', { 
      className: 'header-top',
      style: { 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      } 
    },
      user ? React.createElement(UserAvatar, { 
        avatar: user.avatar, 
        name: user.firstName || user.username, 
        size: 'normal' 
      }) : React.createElement('div', {
        style: {
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)'
        }
      }, '👤'),
      React.createElement('div', { 
        style: { 
          display: 'flex', 
          flexDirection: 'column',
          flex: 1
        } 
      },
        React.createElement('div', { 
          style: { 
            fontWeight: '600', 
            fontSize: '16px',
            color: 'white'
          } 
        }, user?.firstName || 'Загрузка...'),
        React.createElement('div', { 
          style: { 
            fontSize: '14px',
            color: '#ffd700',
            fontWeight: '600'
          } 
        }, user ? `${user.balance} ⭐` : '0 ⭐')
      )
    ),

    // Нижняя навигация
    React.createElement('nav', { 
      className: 'bottom-nav',
      style: {
        display: 'flex',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '8px',
        margin: '8px 16px 16px 16px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }
    },
      React.createElement('button', {
        className: `nav-btn ${currentPage === 'home' ? 'active' : ''}`,
        onClick: () => navigate('home'),
        style: {
          flex: 1,
          padding: '12px',
          background: currentPage === 'home' ? '#ffd700' : 'transparent',
          border: 'none',
          color: currentPage === 'home' ? 'black' : 'white',
          fontSize: '14px',
          fontWeight: '600',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }
      }, 'Главная'),
      
      React.createElement('button', {
        className: `nav-btn ${currentPage === 'game' ? 'active' : ''}`,
        onClick: () => navigate('game'),
        style: {
          flex: 1,
          padding: '12px',
          background: currentPage === 'game' ? '#ffd700' : 'transparent',
          border: 'none',
          color: currentPage === 'game' ? 'black' : 'white',
          fontSize: '14px',
          fontWeight: '600',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }
      }, 'Играть'),
      
      React.createElement('button', {
        className: `nav-btn ${currentPage === 'profile' ? 'active' : ''}`,
        onClick: () => navigate('profile'),
        style: {
          flex: 1,
          padding: '12px',
          background: currentPage === 'profile' ? '#ffd700' : 'transparent',
          border: 'none',
          color: currentPage === 'profile' ? 'black' : 'white',
          fontSize: '14px',
          fontWeight: '600',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }
      }, 'Профиль')
    )
  );
};

// Профиль компонент - ИСПРАВЛЕННАЯ ВЕРСИЯ
const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Функция для получения реальных данных пользователя из Telegram
  const getTelegramUserData = () => {
    try {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        return {
          telegramId: tgUser.id?.toString(),
          firstName: tgUser.first_name || 'Игрок',
          lastName: tgUser.last_name || '',
          username: tgUser.username || '',
          avatar: tgUser.photo_url || null
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting Telegram user data:', error);
      return null;
    }
  };

  const loadUser = async () => {
    try {
      const tgUserData = getTelegramUserData();
      if (!tgUserData) {
        console.log('No Telegram user data in Profile');
        return;
      }

      console.log('Loading user in Profile for:', tgUserData.telegramId);
      
      // Сначала пробуем аутентификацию
      if (window.Telegram?.WebApp?.initData) {
        try {
          const authRes = await API.authenticate(window.Telegram.WebApp.initData);
          if (authRes.success) {
            setUser(authRes.user);
            console.log('User loaded in Profile from auth:', authRes.user);
            return;
          }
        } catch (authErr) {
          console.log('Auth failed in Profile:', authErr);
        }
      }
      
      // Пробуем загрузить профиль с сервера
      try {
        const res = await API.getCurrentUser(tgUserData.telegramId);
        if (res.success) {
          setUser(res.user);
          console.log('User loaded in Profile from API:', res.user);
          return;
        }
      } catch (apiErr) {
        console.log('API profile load failed:', apiErr);
      }
      
      // Если все остальное не сработало, используем данные из Telegram
      const tempUser = {
        ...tgUserData,
        balance: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        totalWinnings: 0
      };
      
      setUser(tempUser);
      console.log('Using temporary user data:', tempUser);
      
    } catch (err) {
      console.log('Profile load error:', err);
      // В случае ошибки пробуем получить базовые данные из Telegram
      const tgUserData = getTelegramUserData();
      if (tgUserData) {
        const tempUser = {
          ...tgUserData,
          balance: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          totalWinnings: 0
        };
        setUser(tempUser);
      }
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handlePayment = async (amount) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const res = await API.createStarsInvoiceLink(user.telegramId, amount);
      if (res.success) {
        window.location.href = res.invoice_link;
      } else {
        alert('Ошибка создания платежа');
      }
    } catch (err) {
      console.log('Payment error:', err);
      alert('Ошибка оплаты. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;
    
    if (user.balance < 10) {
      alert('Минимум 10 ⭐ для вывода');
      return;
    }
    
    if (!confirm(`Вывести ${user.balance} ⭐ на TON Space?`)) return;

    setLoading(true);
    try {
      const res = await API.withdrawToTonSpace(user.telegramId, user.balance);
      if (res.success) {
        alert(res.message);
        // Обновляем баланс
        setUser(prev => prev ? {...prev, balance: 0} : null);
      } else {
        alert(res.error || 'Ошибка вывода');
      }
    } catch (err) {
      console.log('Withdraw error:', err);
      alert('Вывод временно недоступен');
    } finally {
      setLoading(false);
    }
  };

  // Если пользователь не загружен, показываем загрузку
  if (!user) {
    return React.createElement('div', { 
      className: 'loading',
      style: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        fontSize: '1.2rem',
        color: '#ffd700'
      }
    }, 'Загрузка профиля...');
  }

  return React.createElement('div', { className: 'profile' },
    React.createElement(UserAvatar, { 
      avatar: user.avatar, 
      name: user.firstName, 
      size: 'large' 
    }),
    React.createElement('h1', { 
      style: { 
        textAlign: 'center', 
        margin: '1rem 0',
        color: 'white'
      } 
    }, user.firstName || 'Игрок'),
    
    user.username && React.createElement('p', { 
      style: { 
        textAlign: 'center', 
        color: 'rgba(255,255,255,0.7)',
        marginBottom: '1rem'
      } 
    }, `@${user.username}`),
    
    React.createElement('div', { className: 'balance-display' },
      React.createElement('h2', { 
        style: { 
          textAlign: 'center',
          color: '#ffd700',
          marginBottom: '1rem'
        } 
      }, 'Баланс'),
      React.createElement('div', { 
        className: 'balance-value',
        style: {
          fontSize: '2.5rem',
          fontWeight: 'bold',
          color: '#ffd700',
          textAlign: 'center',
          textShadow: '0 0 20px rgba(255,215,0,0.5)',
          marginBottom: '2rem'
        }
      }, `${user.balance} ⭐`)
    ),

    React.createElement('div', { className: 'profile-actions' },
      React.createElement('h2', { 
        style: { 
          textAlign: 'center',
          color: '#ffd700',
          marginBottom: '1rem'
        } 
      }, 'Пополнить баланс'),
      React.createElement('div', { className: 'action-buttons' },
        [10, 50, 100, 500].map(amount => 
          React.createElement('button', {
            key: amount,
            className: 'control-button primary',
            onClick: () => handlePayment(amount),
            disabled: loading,
            style: {
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600'
            }
          }, `${amount} ⭐`)
        )
      )
    ),

    React.createElement('div', { 
      className: 'profile-actions', 
      style: { marginTop: '2rem' } 
    },
      React.createElement('h2', { 
        style: { 
          textAlign: 'center',
          color: '#ffd700',
          marginBottom: '1rem'
        } 
      }, 'Вывод средств'),
      React.createElement('button', {
        className: user.balance >= 10 ? 'control-button success' : 'control-button secondary',
        disabled: loading || user.balance < 10,
        onClick: handleWithdraw,
        style: {
          padding: '1rem 1.5rem',
          fontSize: '1rem',
          fontWeight: '600',
          width: '100%',
          maxWidth: '300px',
          margin: '0 auto',
          display: 'block'
        }
      }, user.balance >= 10 ? `Вывести ${user.balance} ⭐ → TON Space` : 'Минимум 10 ⭐ для вывода')
    ),
    
    // Добавляем статистику
    React.createElement('div', { 
      className: 'stats-grid',
      style: { 
        marginTop: '2rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem'
      } 
    },
      React.createElement('div', { 
        className: 'stat-card',
        style: {
          background: 'rgba(255,255,255,0.1)',
          padding: '1.2rem',
          borderRadius: '12px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      },
        React.createElement('h3', { 
          style: { 
            color: '#ffd700',
            marginBottom: '0.8rem',
            fontSize: '0.9rem'
          } 
        }, 'Сыграно игр'),
        React.createElement('div', { 
          className: 'stat-value',
          style: {
            fontSize: '1.8rem',
            fontWeight: '700',
            color: 'white'
          }
        }, user.gamesPlayed || 0)
      ),
      
      React.createElement('div', { 
        className: 'stat-card',
        style: {
          background: 'rgba(255,255,255,0.1)',
          padding: '1.2rem',
          borderRadius: '12px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      },
        React.createElement('h3', { 
          style: { 
            color: '#ffd700',
            marginBottom: '0.8rem',
            fontSize: '0.9rem'
          } 
        }, 'Побед'),
        React.createElement('div', { 
          className: 'stat-value',
          style: {
            fontSize: '1.8rem',
            fontWeight: '700',
            color: 'white'
          }
        }, user.gamesWon || 0)
      )
    )
  );
};

// Home Page Component
const Home = () => {
    const navigateTo = (page) => {
        window.location.hash = `/${page}`;
    };

    return React.createElement('div', { className: 'home' },
        React.createElement('div', { className: 'hero' },
            React.createElement('h1', null, '🎰 Lucky Number'),
            React.createElement('p', null, 'Реальная лотерея с Telegram Stars! Выбирай номер и выигрывай настоящие призы с реальными игроками.'),
            React.createElement('button', { 
                className: 'cta-button',
                onClick: () => navigateTo('game')
            }, '🎮 Начать игру')
        ),
        React.createElement('div', { className: 'features' },
            React.createElement('h2', { className: 'text-center mb-1', style: { color: '#ffd700', fontSize: '1.2rem' } }, '⭐ Почему мы?'),
            React.createElement('div', { className: 'features-grid' },
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '👥 Реальные игроки'),
                    React.createElement('p', null, 'Только живые соперники, никаких ботов')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '💫 Настоящие звезды'),
                    React.createElement('p', null, 'Выигрывай реальные Telegram Stars')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '⚡ Моментальные выплаты'),
                    React.createElement('p', null, 'Призы сразу на баланс')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '🎯 Простая игра'),
                    React.createElement('p', null, 'Выбери номер и крути рулетку')
                )
            )
        ),
        React.createElement('div', { className: 'text-center mt-1', style: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' } },
            React.createElement('p', null, '💰 Вход: 10 ⭐ • 🎁 Призы: 50% + 25% + 25%')
        )
    );
};

// Roulette Component
const Roulette = ({ onSpinComplete }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);

    const startSpin = () => {
        if (isSpinning) return;
        
        setIsSpinning(true);
        
        const winningNumber = Math.floor(Math.random() * 10) + 1;
        const leftNumber = winningNumber === 1 ? 10 : winningNumber - 1;
        const rightNumber = winningNumber === 10 ? 1 : winningNumber + 1;
        
        console.log('Выигрышные номера:', {
            center: winningNumber,
            left: leftNumber,
            right: rightNumber
        });
        
        const sectorAngle = 36;
        const targetAngle = 180 - ((winningNumber - 1) * sectorAngle);
        const fullRotations = 5;
        const targetRotation = (fullRotations * 360) + targetAngle;
        
        setRotation(targetRotation);
        
        setTimeout(() => {
            setIsSpinning(false);
            
            if (onSpinComplete) {
                onSpinComplete({
                    center: winningNumber,
                    left: leftNumber,  
                    right: rightNumber
                });
            }
        }, 4000);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            startSpin();
        }, 1000);
        
        return () => clearTimeout(timer);
    }, []);

    return React.createElement('div', { className: 'roulette-section' },
        React.createElement('div', { className: 'roulette-container' },
            React.createElement('div', { className: 'roulette-pointer' }),
            React.createElement('div', { className: 'roulette-center' }),
            React.createElement('img', {
                src: 'static/images/roulette.webp',
                className: 'roulette-image',
                style: { 
                    transform: `rotate(${rotation}deg)`,
                    transition: isSpinning ? 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
                },
                alt: "Рулетка",
                onError: (e) => {
                    e.target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'roulette-fallback';
                    fallback.innerHTML = '🎯 1 2 3 4 5 6 7 8 9 10 🎯';
                    fallback.style.cssText = `
                        width: 100%; height: 100%; border-radius: 50%; 
                        background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57);
                        display: flex; align-items: center; justify-content: center;
                        font-size: 20px; font-weight: bold; color: white;
                        border: 6px solid #ffd700; box-shadow: 0 0 20px rgba(255,215,0,0.5);
                    `;
                    e.target.parentNode.appendChild(fallback);
                }
            })
        ),
        
        isSpinning && 
            React.createElement('div', { className: 'spinning-overlay' },
                React.createElement('div', { className: 'spinning-text' }, 'Рулетка крутится...'),
                React.createElement('div', { className: 'spinning-dots' }, '●●●')
            )
    );
};

// Game Component - ИСПРАВЛЕННАЯ ВЕРСИЯ
const Game = () => {
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('waiting');
    const [winners, setWinners] = useState([]);
    const [winningNumbers, setWinningNumbers] = useState(null);
    const [bankAmount, setBankAmount] = useState(0);
    const [joinTime, setJoinTime] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [userNumber, setUserNumber] = useState(null);
    const [loading, setLoading] = useState(false);

    // Функция для получения реальных данных пользователя из Telegram
    const getTelegramUserData = () => {
        try {
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                console.log('🎮 Telegram user data in Game:', tgUser);
                return {
                    telegramId: tgUser.id?.toString(),
                    firstName: tgUser.first_name || 'Игрок',
                    lastName: tgUser.last_name || '',
                    username: tgUser.username || '',
                    avatar: tgUser.photo_url || null
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting Telegram user data in Game:', error);
            return null;
        }
    };

    useEffect(() => {
        const initializeUser = async () => {
            try {
                const tgUserData = getTelegramUserData();
                if (!tgUserData) {
                    console.log('No Telegram user data in Game');
                    return;
                }

                console.log('🎮 Initializing user in Game:', tgUserData.telegramId);

                // Пробуем загрузить пользователя через API
                try {
                    const res = await API.getCurrentUser(tgUserData.telegramId);
                    if (res.success) {
                        setCurrentUser(res.user);
                        console.log('User loaded in Game:', res.user);
                    } else {
                        // Используем Telegram данные как временные
                        setCurrentUser({
                            ...tgUserData,
                            balance: 0,
                            gamesPlayed: 0,
                            gamesWon: 0,
                            totalWinnings: 0
                        });
                    }
                } catch (err) {
                    console.log('API user load failed, using Telegram data');
                    setCurrentUser({
                        ...tgUserData,
                        balance: 0,
                        gamesPlayed: 0,
                        gamesWon: 0,
                        totalWinnings: 0
                    });
                }
            } catch (error) {
                console.error('Error initializing user in Game:', error);
            }
        };

        initializeUser();
        initializeGame();
    }, []);

    useEffect(() => {
        if (gameState === 'waiting') {
            syncGameState();
        }
    }, [gameState]);

    const syncGameState = async () => {
        try {
            const gameData = await API.getCurrentGame();
            if (gameData && gameData.players) {
                setPlayers(gameData.players);
                setBankAmount(gameData.bankAmount || 0);
                setGameState(gameData.status || 'waiting');
                
                const userPlayer = gameData.players.find(player => 
                    player.telegramId === (currentUser?.telegramId)
                );
                if (userPlayer) {
                    setUserNumber(userPlayer.number);
                }
            }
        } catch (error) {
            console.log('Error syncing game state:', error.message);
        }
    };

    const initializeGame = () => {
        setPlayers([]);
        setBankAmount(0);
        setJoinTime(Date.now());
        setUserNumber(null);
    };

    const getUserAvatar = (user) => {
      if (user.avatar && user.avatar !== 'default' && !user.avatar.includes('/i/userpic/320/')) {
        return user.avatar;
      }
      
      return 'default';
    };

    const joinGame = async () => {
        if (players.length >= 10) {
            alert('Лобби заполнено! Ожидайте следующую игру.');
            return;
        }
        
        // Получаем актуальные данные пользователя из Telegram
        const tgUserData = getTelegramUserData();
        if (!tgUserData) {
            alert('❌ Ошибка: не удалось получить данные пользователя');
            return;
        }

        // Проверяем, что у нас реальный telegramId, а не demo-user
        if (tgUserData.telegramId === 'demo-user') {
            alert('❌ Ошибка: приложение запущено в демо-режиме. Запустите через Telegram бота.');
            return;
        }
        
        if (players.find(player => player.telegramId === tgUserData.telegramId)) {
            alert('Вы уже в лобби!');
            return;
        }
        
        if (!currentUser) {
            alert('Ошибка: пользователь не найден');
            return;
        }
        
        if (currentUser.balance < 10) {
            alert('❌ Недостаточно звезд для входа в игру!\n\nНужно: 10 ⭐\nНа балансе: ' + currentUser.balance + ' ⭐\n\nПополните баланс в разделе Профиль.');
            return;
        }
        
        setLoading(true);
        
        try {
            const userAvatar = getUserAvatar(currentUser);
            const userName = currentUser.firstName || 'Игрок';
            
            console.log(`🎮 Отправка запроса join для пользователя:`, {
                telegramId: tgUserData.telegramId,
                name: userName,
                avatar: userAvatar
            });

            const result = await API.joinGame({
                telegramId: tgUserData.telegramId, // Используем реальный telegramId
                name: userName,
                avatar: userAvatar
            });
            
            if (result.success) {
                const userPlayer = {
                    id: 'current-user',
                    telegramId: tgUserData.telegramId,
                    name: userName,
                    number: result.userNumber,
                    avatar: userAvatar,
                    isBot: false
                };
                
                const newPlayers = [...players, userPlayer];
                setPlayers(newPlayers);
                setBankAmount(result.bankAmount);
                setUserNumber(result.userNumber);
                setJoinTime(Date.now());
                
                const updatedUser = { ...currentUser, balance: result.newBalance };
                setCurrentUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                window.dispatchEvent(new CustomEvent('balanceUpdated', {
                    detail: { balance: result.newBalance }
                }));
                
                alert(`✅ Вы присоединились к игре! Ваш номер: ${result.userNumber}\nСписано: 10 ⭐`);
            }
        } catch (error) {
            console.error('Join game failed:', error);
            
            // Более информативные сообщения об ошибках
            if (error.message.includes('Insufficient balance')) {
                alert('❌ Недостаточно звезд для входа в игру!\n\nНужно: 10 ⭐\nПополните баланс в разделе Профиль.');
            } else if (error.message.includes('Already in game')) {
                alert('❌ Вы уже присоединились к этой игре!');
            } else if (error.message.includes('Game is full')) {
                alert('❌ Лобби заполнено! Ожидайте следующую игру.');
            } else {
                alert('❌ Ошибка соединения с сервером. Попробуйте еще раз.');
            }
        } finally {
            setLoading(false);
        }
    };

    const leaveGame = async () => {
        const tgUserData = getTelegramUserData();
        if (!tgUserData || !currentUser) return;
        
        try {
            const result = await API.leaveGame(tgUserData.telegramId);
            if (result.success) {
                const newBalance = result.newBalance;
                const updatedUser = { ...currentUser, balance: newBalance };
                setCurrentUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                window.dispatchEvent(new CustomEvent('balanceUpdated', {
                    detail: { balance: newBalance }
                }));
                
                alert(`✅ Вы покинули лобби. Возвращено: 10 ⭐`);
            }
        } catch (error) {
            console.error('Leave game failed:', error);
            alert('❌ Ошибка при выходе из лобби');
        }
        
        const newPlayers = players.filter(player => player.telegramId === tgUserData.telegramId);
        setPlayers(newPlayers);
        setBankAmount(calculateBank(newPlayers.length));
        setUserNumber(null);
    };

    const calculateBank = (playerCount) => {
        return playerCount * 10;
    };

    const startGame = async () => {
        const realPlayersCount = players.filter(player => !player.isBot).length;
        if (realPlayersCount < 2) {
            alert('❌ Нужно минимум 2 реальных игрока для начала игры! Сейчас: ' + realPlayersCount);
            return;
        }

        try {
            const result = await API.startGame();
            
            if (result.success) {
                setGameState('active');
                setWinners([]);
                setWinningNumbers(null);
                alert('🎮 Игра началась! Рулетка запускается...');
            } else {
                alert('❌ Не удалось начать игру: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('❌ API start failed:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    };

    const handleSpinComplete = async (winningNums) => {
        console.log('Рулетка завершила вращение. Выигрышные номера:', winningNums);
        setWinningNumbers(winningNums);
        
        try {
            // Получаем текущую игру
            const gameData = await API.getCurrentGame();
            if (gameData && gameData.id) {
                // Завершаем игру на сервере
                const finishResult = await API.finishGame(gameData.id, winningNums);
                
                if (finishResult.success) {
                    setWinners(finishResult.winners || []);
                    setBankAmount(finishResult.game?.bankAmount || bankAmount);
                    
                    // Обновляем баланс пользователя если он выиграл
                    const tgUserData = getTelegramUserData();
                    const userWin = finishResult.winners?.find(w => 
                        w.telegramId === tgUserData?.telegramId
                    );
                    
                    if (userWin && currentUser) {
                        const newBalance = currentUser.balance + userWin.prize;
                        const updatedUser = {
                            ...currentUser,
                            balance: newBalance,
                            gamesPlayed: (currentUser.gamesPlayed || 0) + 1,
                            gamesWon: (currentUser.gamesWon || 0) + 1,
                            totalWinnings: (currentUser.totalWinnings || 0) + userWin.prize
                        };
                        
                        setCurrentUser(updatedUser);
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        
                        window.dispatchEvent(new CustomEvent('balanceUpdated', {
                            detail: { balance: newBalance }
                        });
                        
                        alert(`🎉 Поздравляем! Вы выиграли ${userWin.prize} ⭐`);
                    } else if (currentUser) {
                        // Обновляем статистику даже при проигрыше
                        const updatedUser = {
                            ...currentUser,
                            gamesPlayed: (currentUser.gamesPlayed || 0) + 1
                        };
                        setCurrentUser(updatedUser);
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                    }
                }
            }
        } catch (error) {
            console.error('Finish game error:', error);
            // Локальная обработка если сервер не ответил
            handleLocalGameFinish(winningNums);
        }
        
        setGameState('finished');
    };

    // Резервная функция если сервер не отвечает
    const handleLocalGameFinish = (winningNums) => {
        const prizeCenter = Math.floor(bankAmount * 0.5);
        const prizeSide = Math.floor(bankAmount * 0.25);
        
        const winnersList = [];
        
        const centerWinners = players
            .filter(player => player.number === winningNums.center)
            .map(player => ({ 
                ...player, 
                prize: prizeCenter, 
                type: 'center',
                prizeType: 'Главный приз'
            }));
        
        const leftWinners = players
            .filter(player => player.number === winningNums.left)
            .map(player => ({ 
                ...player, 
                prize: prizeSide, 
                type: 'left',
                prizeType: 'Левый приз'
            }));
        
        const rightWinners = players
            .filter(player => player.number === winningNums.right)
            .map(player => ({ 
                ...player, 
                prize: prizeSide, 
                type: 'right',
                prizeType: 'Правый приз'
            }));
        
        winnersList.push(...centerWinners, ...leftWinners, ...rightWinners);
        setWinners(winnersList);
        
        console.log('Победители (локально):', winnersList);
    };

    const startNewRound = () => {
        setGameState('waiting');
        setWinners([]);
        setWinningNumbers(null);
        setUserNumber(null);
        initializeGame();
    };

    const isUserInGame = players.some(player => {
        const tgUserData = getTelegramUserData();
        return tgUserData && player.telegramId === tgUserData.telegramId;
    });
    
    const timeInLobby = joinTime ? Math.floor((Date.now() - joinTime) / 1000) : 0;
    const realPlayersCount = players.filter(player => !player.isBot).length;

    return React.createElement('div', { className: 'game-page' },
        gameState === 'waiting' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '👥 Игровое лобби'),
                    React.createElement('div', { className: 'lobby-stats' },
                        React.createElement('p', null, `Игроков: ${realPlayersCount}/10`),
                        React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                        userNumber && 
                            React.createElement('p', { className: 'text-accent' }, 
                                `Ваш номер: ${userNumber}`
                            ),
                        React.createElement('p', null, 
                            `Время: ${Math.floor(timeInLobby / 60)}:${(timeInLobby % 60).toString().padStart(2, '0')}`
                        )
                    ),
                    
                    !isUserInGame ? 
                        React.createElement('button', { 
                            className: 'control-button primary',
                            onClick: joinGame,
                            disabled: players.length >= 10 || loading
                        }, loading ? 'Подключение...' : players.length >= 10 ? 'Лобби заполнено' : `Войти в игру (10 ⭐)`) :
                        React.createElement('div', null,
                            realPlayersCount >= 2 && 
                                React.createElement('button', { 
                                    className: 'control-button primary',
                                    onClick: startGame
                                }, '🎮 Начать игру'),
                            React.createElement('button', { 
                                className: 'control-button secondary',
                                onClick: leaveGame,
                                disabled: loading,
                                style: { marginTop: '0.5rem' }
                            }, loading ? 'Выход...' : 'Выйти из лобби')
                        )
                ),

                React.createElement('div', { className: 'players-grid' },
                    players.map(player => 
                        React.createElement('div', { 
                            key: player.id || player.telegramId,
                            className: `player-card ${player.telegramId === currentUser?.telegramId ? 'current-user' : ''}`
                        },
                            React.createElement(UserAvatar, { avatar: player.avatar, size: 'normal' }),
                            React.createElement('div', { className: 'player-name' }, player.name),
                            React.createElement('div', { className: 'player-number' }, `#${player.number}`),
                            player.telegramId === currentUser?.telegramId && React.createElement('div', { 
                                className: 'player-badge'
                            }, 'Вы')
                        )
                    ),
                    
                    ...Array.from({ length: 10 - players.length }, (_, index) => 
                        React.createElement('div', { 
                            key: `empty-${index}`, 
                            className: 'player-card empty-slot'
                        },
                            React.createElement('div', { className: 'player-avatar' }, '○'),
                            React.createElement('div', { className: 'player-name' }, 'Свободно'),
                            React.createElement('div', { className: 'player-number' }, '?')
                        )
                    )
                )
            ),

        gameState === 'active' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '🎯 Игра началась!'),
                    React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                    React.createElement('p', null, `Игроков: ${realPlayersCount}`)
                ),
                React.createElement(Roulette, { onSpinComplete: handleSpinComplete })
            ),

        gameState === 'finished' &&
            React.createElement('div', { className: 'results-section' },
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '🎉 Результаты раунда!'),
                    React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                    
                    winningNumbers &&
                        React.createElement('div', { style: { margin: '1rem 0', padding: '1rem', background: 'rgba(255,215,0,0.1)', borderRadius: '12px' } },
                            React.createElement('p', { style: { marginBottom: '0.5rem', fontWeight: '600' } }, 'Выигрышные номера:'),
                            React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: '1.5rem', fontSize: '1.1rem' } },
                                React.createElement('div', { className: 'text-accent' }, 
                                    `${winningNumbers.left} (25%)`
                                ),
                                React.createElement('div', { className: 'text-accent', style: { fontSize: '1.3rem', fontWeight: '700' } }, 
                                    `${winningNumbers.center} (50%)`
                                ),
                                React.createElement('div', { className: 'text-accent' }, 
                                    `${winningNumbers.right} (25%)`
                                )
                            )
                        )
                ),
                
                winners.length > 0 ? 
                    React.createElement('div', { className: 'winners-display' },
                        React.createElement('h3', { style: { marginBottom: '1rem', color: '#4caf50' } }, '🏆 Победители'),
                        winners.map((winner, index) => 
                            React.createElement('div', { 
                                key: `${winner.id || winner.telegramId}-${winner.type}`,
                                className: `winner-badge ${winner.telegramId === currentUser?.telegramId ? 'current-user' : ''} winner-${winner.type}`
                            },
                                React.createElement(UserAvatar, { avatar: winner.avatar, size: 'normal' }),
                                React.createElement('div', { className: 'winner-info' },
                                    React.createElement('div', { className: 'winner-name' }, winner.name),
                                    React.createElement('div', { className: 'winner-prize' }, 
                                        `${winner.prizeType}: ${winner.prize} ⭐`
                                    )
                                )
                            )
                        )
                    ) :
                    React.createElement('div', { className: 'room-info' },
                        React.createElement('p', null, 'В этом раунде победителей нет'),
                        React.createElement('p', { style: { marginTop: '0.5rem', opacity: 0.8 } }, 
                            'Никто не угадал выигрышные номера'
                        )
                    ),
                
                React.createElement('div', { className: 'game-controls' },
                    React.createElement('button', { 
                        className: 'control-button primary',
                        onClick: startNewRound
                    }, '🔄 Новая игра')
                )
            )
    );
};

// Main App Component
const App = () => {
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      Telegram.WebApp.ready();
      Telegram.WebApp.expand();
    }

    // Функция для безопасного получения текущей страницы из хеша
    const getCurrentPageFromHash = () => {
      const hash = window.location.hash;
      console.log('App - Current hash:', hash);
      
      if (!hash || hash === '#' || hash === '#/') {
        return 'home';
      }
      
      const match = hash.match(/^#\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        return match[1];
      }
      
      if (hash.includes('tgWebAppData')) {
        return 'home';
      }
      
      return 'home';
    };

    const handleHashChange = () => {
      const page = getCurrentPageFromHash();
      setCurrentPage(page);
      console.log('App - Page changed to:', page);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return React.createElement('div', { className: 'App' },
    React.createElement(Header),
    React.createElement('main', null,
      currentPage === 'profile' ? React.createElement(Profile) :
      currentPage === 'game' ? React.createElement(Game) :
      React.createElement(Home)
    )
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
