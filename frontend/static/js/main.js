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

// Game Component - ПОЛНАЯ ВЕРСИЯ С ЛОББИ
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

    // Загрузка текущего состояния игры
    const loadGameState = async () => {
        try {
            const gameData = await API.getCurrentGame();
            if (gameData) {
                setPlayers(gameData.players || []);
                setBankAmount(gameData.bankAmount || 0);
                setGameState(gameData.status || 'waiting');
                
                // Проверяем, есть ли текущий пользователь в игре
                const tgUserData = getTelegramUserData();
                if (tgUserData && gameData.players) {
                    const userPlayer = gameData.players.find(player => 
                        player.telegramId === tgUserData.telegramId
                    );
                    if (userPlayer) {
                        setUserNumber(userPlayer.number);
                    }
                }
            }
        } catch (error) {
            console.log('Error loading game state:', error);
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
        loadGameState();
        
        // Интервал для обновления состояния игры
        const interval = setInterval(loadGameState, 3000);
        return () => clearInterval(interval);
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
                // Обновляем состояние
                setPlayers(result.game.players || []);
                setBankAmount(result.game.bankAmount || 0);
                setUserNumber(result.userNumber);
                setJoinTime(Date.now());
                
                // Обновляем баланс пользователя
                const updatedUser = { ...currentUser, balance: result.newBalance };
                setCurrentUser(updatedUser);
                
                alert(`✅ Вы присоединились к игре! Ваш номер: ${result.userNumber}`);
                
                // Перезагружаем состояние игры
                loadGameState();
            }
        } catch (error) {
            console.error('Join game failed:', error);
            
            if (error.message.includes('Insufficient balance')) {
                alert('❌ Недостаточно звезд для входа в игру!\n\nНужно: 10 ⭐\nПополните баланс в разделе Профиль.');
            } else if (error.message.includes('Already in game')) {
                alert('❌ Вы уже присоединились к этой игре!');
                loadGameState(); // Перезагружаем состояние
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
        
        setLoading(true);
        try {
            const result = await API.leaveGame(tgUserData.telegramId);
            if (result.success) {
                // Обновляем баланс пользователя
                const updatedUser = { ...currentUser, balance: result.newBalance };
                setCurrentUser(updatedUser);
                
                alert(`✅ Вы покинули лобби. Возвращено: 10 ⭐`);
                
                // Перезагружаем состояние игры
                loadGameState();
                setUserNumber(null);
            }
        } catch (error) {
            console.error('Leave game failed:', error);
            alert('❌ Ошибка при выходе из лобби');
        } finally {
            setLoading(false);
        }
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
                        alert(`🎉 Поздравляем! Вы выиграли ${userWin.prize} ⭐`);
                    } else if (currentUser) {
                        // Обновляем статистику даже при проигрыше
                        const updatedUser = {
                            ...currentUser,
                            gamesPlayed: (currentUser.gamesPlayed || 0) + 1
                        };
                        setCurrentUser(updatedUser);
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
    };

    const startNewRound = () => {
        setGameState('waiting');
        setWinners([]);
        setWinningNumbers(null);
        setUserNumber(null);
        loadGameState(); // Загружаем новое состояние игры
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
                        React.createElement('p', null, `Игроков: ${players.length}/10`),
                        React.createElement('p', null, `Реальных игроков: ${realPlayersCount}`),
                        React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                        userNumber && 
                            React.createElement('p', { className: 'text-accent' }, 
                                `Ваш номер: ${userNumber}`
                            ),
                        joinTime && 
                            React.createElement('p', null, 
                                `В лобби: ${Math.floor(timeInLobby / 60)}:${(timeInLobby % 60).toString().padStart(2, '0')}`
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
                            React.createElement(UserAvatar, { 
                                avatar: player.avatar, 
                                name: player.name, 
                                size: 'normal' 
                            }),
                            React.createElement('div', { className: 'player-name' }, player.name),
                            React.createElement('div', { className: 'player-number' }, `#${player.number}`),
                            player.telegramId === currentUser?.telegramId && 
                                React.createElement('div', { className: 'player-badge' }, 'Вы')
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
                    React.createElement('p', null, `Игроков: ${players.length}`)
                ),
                React.createElement(Roulette, { onSpinComplete: handleSpinComplete })
            ),

        gameState === 'finished' &&
            React.createElement('div', { className: 'results-section' },
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '🎉 Результаты раунда!'),
                    React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                    
                    winningNumbers &&
                        React.createElement('div', { 
                            style: { 
                                margin: '1rem 0', 
                                padding: '1rem', 
                                background: 'rgba(255,215,0,0.1)', 
                                borderRadius: '12px' 
                            } 
                        },
                            React.createElement('p', { 
                                style: { marginBottom: '0.5rem', fontWeight: '600' } 
                            }, 'Выигрышные номера:'),
                            React.createElement('div', { 
                                style: { 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    gap: '1.5rem', 
                                    fontSize: '1.1rem' 
                                } 
                            },
                                React.createElement('div', { className: 'text-accent' }, 
                                    `${winningNumbers.left} (25%)`
                                ),
                                React.createElement('div', { 
                                    className: 'text-accent', 
                                    style: { fontSize: '1.3rem', fontWeight: '700' } 
                                }, `${winningNumbers.center} (50%)`),
                                React.createElement('div', { className: 'text-accent' }, 
                                    `${winningNumbers.right} (25%)`
                                )
                            )
                        )
                ),
                
                winners.length > 0 ? 
                    React.createElement('div', { className: 'winners-display' },
                        React.createElement('h3', { 
                            style: { marginBottom: '1rem', color: '#4caf50' } 
                        }, '🏆 Победители'),
                        winners.map((winner, index) => 
                            React.createElement('div', { 
                                key: `${winner.id || winner.telegramId}-${winner.type}`,
                                className: `winner-badge ${winner.telegramId === currentUser?.telegramId ? 'current-user' : ''} winner-${winner.type}`
                            },
                                React.createElement(UserAvatar, { 
                                    avatar: winner.avatar, 
                                    name: winner.name, 
                                    size: 'normal' 
                                }),
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
                        React.createElement('p', { 
                            style: { marginTop: '0.5rem', opacity: 0.8 } 
                        }, 'Никто не угадал выигрышные номера')
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

