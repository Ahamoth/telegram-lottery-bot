const { useState, useEffect } = React;

// API сервис - ИСПРАВЛЕННАЯ ВЕРСИЯ
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

  // Методы API
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
  
  getUserProfile(id) { 
    return this.request(`/user/profile/${id}`); 
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

// Header Component
const Header = () => {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (!tgUser) {
          console.log('No Telegram user data found');
          return;
        }

        console.log('Loading user data for:', tgUser.id);
        const res = await API.getUserProfile(tgUser.id.toString());
        if (res.success) {
          setUser(res.user);
          console.log('User loaded:', res.user);
        } else {
          console.log('Failed to load user profile');
        }
      } catch (err) {
        console.log('User load error:', err);
      }
    };

    loadUser();

    // Слушаем изменение хеша для навигации
    const handleHashChange = () => {
      const page = window.location.hash.slice(1) || 'home';
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
    window.location.hash = page;
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

// Профиль компонент
const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadUser = async () => {
    const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    if (!tgUser) return;
    try {
      const res = await API.getUserProfile(tgUser.id);
      if (res.success) setUser(res.user);
    } catch (err) {
      console.log('Profile load error:', err);
    }
  };

  useEffect(() => {
    loadUser();
    const interval = setInterval(loadUser, 8000);
    return () => clearInterval(interval);
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
        [10, 50, 100, 500].map(amount => 
          React.createElement('button', {
            key: amount,
            className: 'control-button primary',
            onClick: () => handlePayment(amount),
            disabled: loading
          }, `${amount} ⭐`)
        )
      )
    ),

    React.createElement('div', { className: 'profile-actions', style: { marginTop: '2rem' } },
      React.createElement('h2', null, 'Вывод на TON Space'),
      React.createElement('button', {
        className: 'control-button success',
        disabled: loading || user.balance < 10,
        onClick: handleWithdraw
      }, `Вывести ${user.balance} ⭐ → TON Space`)
    )
  );
};

// Home Page Component
const Home = () => {
    const navigateTo = (page) => {
        window.location.hash = page;
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

// Game Component
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

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const userData = JSON.parse(savedUser);
            setCurrentUser(userData);
        }
        
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
        
        if (players.find(player => player.telegramId === currentUser?.telegramId)) {
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
            
            const result = await API.joinGame({
                telegramId: currentUser.telegramId,
                name: userName,
                avatar: userAvatar
            });
            
            if (result.success) {
                const userPlayer = {
                    id: 'current-user',
                    telegramId: currentUser.telegramId,
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
            alert('❌ Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    const leaveGame = async () => {
        if (!currentUser) return;
        
        try {
            const result = await API.leaveGame(currentUser.telegramId);
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
        
        const newPlayers = players.filter(player => player.telegramId !== currentUser.telegramId);
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
            } else {
                alert('❌ Не удалось начать игру');
            }
        } catch (error) {
            console.error('❌ API start failed:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    };

    const handleSpinComplete = (winningNums) => {
        console.log('Рулетка завершила вращение. Выигрышные номера:', winningNums);
        setWinningNumbers(winningNums);
        
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
        setGameState('finished');
        
        console.log('Победители:', winnersList);
        updateUserStats(winnersList);
    };

    const updateUserStats = (winnersList) => {
        const userWinnings = winnersList
            .filter(winner => winner.telegramId === currentUser?.telegramId)
            .reduce((total, winner) => total + winner.prize, 0);
        
        if (userWinnings > 0 && currentUser) {
            const newBalance = currentUser.balance + userWinnings;
            const updatedUser = {
                ...currentUser,
                balance: newBalance,
                gamesPlayed: (currentUser.gamesPlayed || 0) + 1,
                gamesWon: (currentUser.gamesWon || 0) + 1,
                totalWinnings: (currentUser.totalWinnings || 0) + userWinnings
            };
            
            setCurrentUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            window.dispatchEvent(new CustomEvent('balanceUpdated', {
                detail: { balance: newBalance }
            }));
            
            alert(`🎉 Поздравляем! Вы выиграли ${userWinnings} ⭐`);
        } else if (currentUser) {
            const updatedUser = {
                ...currentUser,
                gamesPlayed: (currentUser.gamesPlayed || 0) + 1
            };
            setCurrentUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
    };

    const startNewRound = () => {
        setGameState('waiting');
        setWinners([]);
        setWinningNumbers(null);
        setUserNumber(null);
        initializeGame();
    };

    const isUserInGame = players.some(player => player.telegramId === currentUser?.telegramId);
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
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      Telegram.WebApp.ready();
      Telegram.WebApp.expand();
    }
  }, []);

  const page = window.location.hash.slice(1) || 'home';

  return React.createElement('div', { className: 'App' },
    React.createElement(Header),
    React.createElement('main', null,
      page === 'profile' ? React.createElement(Profile) :
      page === 'game' ? React.createElement(Game) :
      React.createElement(Home)
    )
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
