const { useState, useEffect } = React;

// API сервис
const API = {
  baseUrl: 'https://telegram-lottery-api-production.up.railway.app',

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}/api${endpoint}`;
      const response = await fetch(url, {
        headers: { 
          'Content-Type': 'application/json', 
          ...options.headers 
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      console.error('API request failed:', err);
      throw err;
    }
  },

  authenticate(initData) { 
    return this.request('/auth/telegram', { 
      method: 'POST', 
      body: JSON.stringify({ initData }) 
    }); 
  },
  
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

  getCurrentUser(telegramId) { 
    return this.request(`/user/current?telegramId=${telegramId}`); 
  },

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
  }
};

// Аватар компонент
const UserAvatar = ({ avatar, name = '', size = 'normal' }) => {
  const sizes = { large: '56px', normal: '40px', small: '32px' };
  
  if (avatar && avatar.startsWith('https://') && !avatar.includes('.svg')) {
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
      }
    });
  }

  const initials = name ? name.charAt(0).toUpperCase() : '?';

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

// Header Component
const Header = () => {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');

  const getTelegramUserData = () => {
    try {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        return {
          telegramId: tgUser.id.toString(),
          firstName: tgUser.first_name || 'Игрок',
          username: tgUser.username || '',
          avatar: tgUser.photo_url || null
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const tgUserData = getTelegramUserData();
        if (!tgUserData) return;

        try {
          if (window.Telegram?.WebApp?.initData) {
            const authRes = await API.authenticate(window.Telegram.WebApp.initData);
            if (authRes.success) {
              setUser(authRes.user);
              return;
            }
          }
        } catch (authErr) {}

        try {
          const res = await API.getCurrentUser(tgUserData.telegramId);
          if (res.success) {
            setUser(res.user);
          } else {
            setUser({ ...tgUserData, balance: 0 });
          }
        } catch (profileErr) {
          setUser({ ...tgUserData, balance: 0 });
        }
      } catch (err) {
        console.log('User load error:', err);
      }
    };

    loadUser();

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/game') setCurrentPage('game');
      else if (hash === '#/profile') setCurrentPage('profile');
      else setCurrentPage('home');
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (page) => {
    window.location.hash = `/${page}`;
  };

  return React.createElement('header', { 
    className: 'header',
    style: { 
      background: 'var(--bg-dark)',
      padding: '0',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }
  },
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
        name: user.firstName, 
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

    React.createElement('nav', { 
      className: 'bottom-nav',
      style: {
        display: 'flex',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '8px',
        margin: '8px 16px 16px 16px'
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
          cursor: 'pointer'
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
          cursor: 'pointer'
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
          cursor: 'pointer'
        }
      }, 'Профиль')
    )
  );
};

// Профиль компонент
const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const getTelegramUserData = () => {
    try {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        return {
          telegramId: tgUser.id.toString(),
          firstName: tgUser.first_name || 'Игрок',
          username: tgUser.username || '',
          avatar: tgUser.photo_url || null
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const loadUser = async () => {
    try {
      const tgUserData = getTelegramUserData();
      if (!tgUserData) return;

      try {
        const res = await API.getCurrentUser(tgUserData.telegramId);
        if (res.success) {
          setUser(res.user);
          return;
        }
      } catch (apiErr) {}
      
      setUser({ ...tgUserData, balance: 0 });
      
    } catch (err) {
      const tgUserData = getTelegramUserData();
      if (tgUserData) {
        setUser({ ...tgUserData, balance: 0 });
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
      alert('Ошибка оплаты');
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
        setUser(prev => prev ? {...prev, balance: 0} : null);
      } else {
        alert(res.error || 'Ошибка вывода');
      }
    } catch (err) {
      alert('Вывод временно недоступен');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return React.createElement('div', { 
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
      React.createElement('div', { 
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.8rem',
          marginTop: '1rem'
        } 
      },
        [10, 50, 100, 500].map(amount => 
          React.createElement('button', {
            key: amount,
            onClick: () => handlePayment(amount),
            disabled: loading,
            style: {
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer'
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
        onClick: handleWithdraw,
        disabled: loading || user.balance < 10,
        style: {
          padding: '1rem 1.5rem',
          fontSize: '1rem',
          fontWeight: '600',
          background: user.balance >= 10 ? '#ffd700' : '#666',
          color: user.balance >= 10 ? 'black' : 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: user.balance >= 10 ? 'pointer' : 'not-allowed',
          width: '100%',
          maxWidth: '300px',
          margin: '0 auto',
          display: 'block'
        }
      }, user.balance >= 10 ? `Вывести ${user.balance} ⭐ → TON Space` : 'Минимум 10 ⭐ для вывода')
    ),
    
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
                onClick: () => navigateTo('game'),
                style: {
                  background: 'var(--secondary-gradient)',
                  border: 'none',
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  color: 'white',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }
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
                    fallback.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: white; border: 6px solid #ffd700; box-shadow: 0 0 20px rgba(255,215,0,0.5);';
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

const Game

// Main App Component
const App = () => {
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      Telegram.WebApp.ready();
      Telegram.WebApp.expand();
    }

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/game') setCurrentPage('game');
      else if (hash === '#/profile') setCurrentPage('profile');
      else setCurrentPage('home');
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
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

