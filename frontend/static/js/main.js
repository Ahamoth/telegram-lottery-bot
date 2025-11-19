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
  
  getCurrentUser(telegramId) { 
    return this.request(`/user/current?telegramId=${telegramId}`); 
  },

  createStarsInvoiceLink(telegramId, amount) { 
    return this.request('/payment/create-invoice-link', { 
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
        border: '3px solid #ffd700'
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
      border: '3px solid #ffd700'
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

        // Пробуем аутентификацию
        try {
          if (window.Telegram?.WebApp?.initData) {
            const authRes = await API.authenticate(window.Telegram.WebApp.initData);
            if (authRes.success) {
              setUser(authRes.user);
              return;
            }
          }
        } catch (authErr) {}

        // Пробуем загрузить профиль
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
            React.createElement('p', null, 'Реальная лотерея с Telegram Stars!'),
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
        )
    );
};

// Game Component
const Game = () => {
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('waiting');
    const [currentUser, setCurrentUser] = useState(null);
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

    useEffect(() => {
        const initializeUser = async () => {
            try {
                const tgUserData = getTelegramUserData();
                if (!tgUserData) return;

                try {
                    const res = await API.getCurrentUser(tgUserData.telegramId);
                    if (res.success) {
                        setCurrentUser(res.user);
                    } else {
                        setCurrentUser({ ...tgUserData, balance: 0 });
                    }
                } catch (err) {
                    setCurrentUser({ ...tgUserData, balance: 0 });
                }
            } catch (error) {
                console.error('Error initializing user:', error);
            }
        };

        initializeUser();
    }, []);

    const joinGame = async () => {
        const tgUserData = getTelegramUserData();
        if (!tgUserData) {
            alert('❌ Ошибка: не удалось получить данные пользователя');
            return;
        }

        if (!currentUser) {
            alert('Ошибка: пользователь не найден');
            return;
        }
        
        if (currentUser.balance < 10) {
            alert('❌ Недостаточно звезд для входа в игру! Нужно: 10 ⭐');
            return;
        }
        
        setLoading(true);
        
        try {
            const result = await API.joinGame({
                telegramId: tgUserData.telegramId,
                name: currentUser.firstName || 'Игрок',
                avatar: currentUser.avatar || 'default'
            });
            
            if (result.success) {
                const userPlayer = {
                    telegramId: tgUserData.telegramId,
                    name: currentUser.firstName,
                    number: result.userNumber,
                    avatar: currentUser.avatar
                };
                
                setPlayers([...players, userPlayer]);
                setCurrentUser({ ...currentUser, balance: result.newBalance });
                alert(`✅ Вы присоединились к игре! Ваш номер: ${result.userNumber}`);
            }
        } catch (error) {
            console.error('Join game failed:', error);
            alert('❌ Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    const isUserInGame = players.some(player => {
        const tgUserData = getTelegramUserData();
        return tgUserData && player.telegramId === tgUserData.telegramId;
    });

    return React.createElement('div', { className: 'game-page' },
        gameState === 'waiting' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '👥 Игровое лобби'),
                    React.createElement('div', { className: 'lobby-stats' },
                        React.createElement('p', null, `Игроков: ${players.length}/10`),
                        React.createElement('p', null, `Банк: ${players.length * 10} ⭐`)
                    ),
                    
                    !isUserInGame ? 
                        React.createElement('button', { 
                            onClick: joinGame,
                            disabled: players.length >= 10 || loading,
                            style: {
                                padding: '1rem 2rem',
                                background: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }
                        }, loading ? 'Подключение...' : players.length >= 10 ? 'Лобби заполнено' : `Войти в игру (10 ⭐)`) :
                        React.createElement('button', { 
                            onClick: () => API.startGame().then(() => setGameState('active')),
                            disabled: players.length < 2,
                            style: {
                                padding: '1rem 2rem',
                                background: players.length >= 2 ? '#ffd700' : '#666',
                                color: 'black',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: players.length >= 2 ? 'pointer' : 'not-allowed'
                            }
                        }, players.length >= 2 ? '🎮 Начать игру' : 'Нужно 2+ игроков')
                ),

                React.createElement('div', { 
                    style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                        gap: '0.8rem',
                        margin: '1.5rem 0'
                    } 
                },
                    players.map(player => 
                        React.createElement('div', { 
                            key: player.telegramId,
                            style: {
                                background: 'rgba(255,255,255,0.1)',
                                padding: '1rem 0.5rem',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }
                        },
                            React.createElement(UserAvatar, { avatar: player.avatar, size: 'normal' }),
                            React.createElement('div', { 
                                style: { 
                                    fontWeight: '600',
                                    marginBottom: '0.3rem',
                                    fontSize: '0.85rem'
                                } 
                            }, player.name),
                            React.createElement('div', { 
                                style: { 
                                    fontSize: '1.1rem',
                                    color: '#ffd700',
                                    fontWeight: '700'
                                } 
                            }, `#${player.number}`)
                        )
                    )
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
