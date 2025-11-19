// main.js
const { useState, useEffect, useRef } = React;

// API service
const API = {
  baseUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://telegram-lottery-bot-e75s.onrender.com',
  
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        // Получаем детальную информацию об ошибке от сервера
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Если не удалось распарсить JSON, используем стандартное сообщение
        }
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  async authenticate(initData) {
    return this.request('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
  },

  async getCurrentGame() {
    return this.request('/game/current');
  },

  async joinGame(userData) {
    return this.request('/game/join', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async startGame() {
    return this.request('/game/start', {
      method: 'POST',
    });
  },

  async finishGame(gameId, winningNumbers) {
    return this.request('/game/finish', {
      method: 'POST',
      body: JSON.stringify({ gameId, winningNumbers }),
    });
  },

  async leaveGame(telegramId) {
    return this.request('/game/leave', {
      method: 'POST',
      body: JSON.stringify({ telegramId }),
    });
  },

  async getUserProfile(telegramId) {
    return this.request(`/user/profile/${telegramId}`);
  },

  async createInvoice(telegramId, amount) {
    return this.request('/payment/create-invoice', {
      method: 'POST',
      body: JSON.stringify({ telegramId, amount, currency: 'XTR' }),
    });
  },

  async confirmPayment(paymentData) {
    return this.request('/payment/confirm-payment', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  async demoPayment(telegramId, amount) {
    return this.request('/payment/demo-payment', {
      method: 'POST',
      body: JSON.stringify({ telegramId, amount }),
    });
  },

  async getPaymentHistory(telegramId, limit = 10) {
    return this.request(`/payment/history/${telegramId}?limit=${limit}`);
  }
};

// Компонент для отображения аватара
const UserAvatar = ({ avatar, size = 'normal' }) => {
  const isDefault = avatar === 'default' || !avatar;
  const isImageUrl = typeof avatar === 'string' && avatar.startsWith('http');
  const isTelegramSVG = typeof avatar === 'string' && avatar.includes('userpic/320/');
  
  const avatarStyles = {
    width: size === 'large' ? '44px' : size === 'normal' ? '36px' : '28px',
    height: size === 'large' ? '44px' : size === 'normal' ? '36px' : '28px',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid rgba(255, 215, 0, 0.5)'
  };

  if (isImageUrl && !isTelegramSVG) {
    return React.createElement('img', {
      src: avatar,
      className: `user-avatar ${size}`,
      style: avatarStyles,
      alt: "User Avatar",
      onError: (e) => {
        e.target.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = `user-avatar ${size} default-avatar`;
        fallback.style.cssText = `
          ${Object.entries(avatarStyles).map(([key, value]) => `${key}: ${value};`).join(' ')}
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          font-size: ${size === 'large' ? '18px' : size === 'normal' ? '16px' : '14px'};
        `;
        fallback.innerHTML = '👤';
        e.target.parentNode.appendChild(fallback);
      }
    });
  } else {
    return React.createElement('div', {
      className: `user-avatar ${size} default-avatar`,
      style: {
        ...avatarStyles,
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        fontSize: size === 'large' ? '18px' : size === 'normal' ? '16px' : '14px',
        fontWeight: 'bold'
      }
    }, '👤');
  }
};

// Compact Header Component
const Header = ({ currentPage }) => {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [userAvatar, setUserAvatar] = useState('👤');
    
    useEffect(() => {
        initializeUser();
        
        const handleBalanceUpdate = (event) => {
            if (event.detail && event.detail.balance) {
                setBalance(event.detail.balance);
            }
        };
        
        window.addEventListener('balanceUpdated', handleBalanceUpdate);
        return () => window.removeEventListener('balanceUpdated', handleBalanceUpdate);
    }, []);

    const initializeUser = async () => {
        if (window.Telegram?.WebApp) {
            try {
                const initData = window.Telegram.WebApp.initData;
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                
                console.log('Telegram User:', tgUser);
                
                const avatar = generateTelegramAvatar(tgUser);
                setUserAvatar(avatar);
                
                // Сохраняем базовую информацию о пользователе
                const userData = {
                    telegramId: tgUser?.id?.toString(),
                    firstName: tgUser?.first_name || 'User',
                    lastName: tgUser?.last_name || '',
                    username: tgUser?.username || '',
                    avatar: avatar,
                    balance: 100, // Начальный баланс для демо
                    gamesPlayed: 0,
                    gamesWon: 0,
                    totalWinnings: 0
                };
                
                setUser(userData);
                setBalance(userData.balance);
                localStorage.setItem('user', JSON.stringify(userData));
                
                // Пытаемся аутентифицироваться на сервере
                try {
                    const result = await API.authenticate(initData);
                    if (result.success) {
                        const userWithAvatar = {
                            ...result.user,
                            avatar: avatar
                        };
                        setUser(userWithAvatar);
                        setBalance(result.user.balance);
                        localStorage.setItem('user', JSON.stringify(userWithAvatar));
                    }
                } catch (authError) {
                    console.log('Auth failed, using local user:', authError.message);
                }
                
            } catch (error) {
                console.error('Telegram init failed:', error);
                // Создаем демо пользователя если Telegram не доступен
                createDemoUser();
            }
        } else {
            createDemoUser();
        }
    };

    const createDemoUser = () => {
        const demoUser = {
            telegramId: 'demo_' + Date.now(),
            firstName: 'Demo User',
            balance: 100,
            gamesPlayed: 0,
            gamesWon: 0,
            totalWinnings: 0,
            avatar: 'default'
        };
        setUser(demoUser);
        setBalance(demoUser.balance);
        localStorage.setItem('user', JSON.stringify(demoUser));
    };

    const generateTelegramAvatar = (tgUser) => {
        if (!tgUser) return 'default';
        if (tgUser.photo_url && !tgUser.photo_url.includes('/i/userpic/320/')) {
            return tgUser.photo_url;
        }
        return 'default';
    };

    const navigateTo = (page) => {
        window.location.hash = page;
    };

    const isActive = (page) => currentPage === page ? 'active' : '';

    return React.createElement('header', { className: 'header' },
        React.createElement('div', { className: 'logo' }, '🎰 Lucky Number'),
        React.createElement('nav', null,
            React.createElement('ul', { className: 'nav-links' },
                React.createElement('li', null, 
                    React.createElement('a', { 
                        href: '#home',
                        className: isActive('home'),
                        onClick: (e) => { e.preventDefault(); navigateTo('home'); }
                    }, 'Главная')
                ),
                React.createElement('li', null, 
                    React.createElement('a', { 
                        href: '#game',
                        className: isActive('game'),
                        onClick: (e) => { e.preventDefault(); navigateTo('game'); }
                    }, 'Играть')
                ),
                React.createElement('li', null, 
                    React.createElement('a', { 
                        href: '#profile',
                        className: isActive('profile'),
                        onClick: (e) => { e.preventDefault(); navigateTo('profile'); }
                    }, 'Профиль')
                )
            )
        ),
        React.createElement('div', { className: 'header-user' },
            React.createElement(UserAvatar, { avatar: userAvatar, size: 'normal' }),
            React.createElement('div', { className: 'balance' }, balance)
        )
    );
};

// Compact Home Page Component
const Home = () => {
    const navigateTo = (page) => {
        window.location.hash = page;
    };

    return React.createElement('div', { className: 'home' },
        React.createElement('div', { className: 'hero' },
            React.createElement('h1', null, '🎰 Lucky Number'),
            React.createElement('p', null, 'Реальная лотерея с Telegram Stars!'),
            React.createElement('p', null, 'Получи номер от 1 до 10 и выигрывай настоящие звезды!'),
            React.createElement('button', { 
                className: 'cta-button',
                onClick: () => navigateTo('game')
            }, 'Начать играть')
        ),
        React.createElement('div', { className: 'how-to-play' },
            React.createElement('h2', null, '🎯 Как играть?'),
            React.createElement('ol', null,
                React.createElement('li', null, 'Пополните баланс звездами'),
                React.createElement('li', null, 'Присоединитесь к лобби'),
                React.createElement('li', null, 'Получите уникальный номер'),
                React.createElement('li', null, 'Ждите начала игры (2+ игрока)'),
                React.createElement('li', null, 'Следите за рулеткой'),
                React.createElement('li', null, 'Получайте выигрыш!')
            ),
            React.createElement('p', { style: { marginTop: '1rem', textAlign: 'center', color: '#ffd700' } }, 
                '💰 Призы: 50% / 25% / 25% от банка!'
            )
        ),
        React.createElement('div', { className: 'features' },
            React.createElement('h2', null, '⭐ Почему мы?'),
            React.createElement('div', { className: 'features-grid' },
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '👥 Реальные игроки'),
                    React.createElement('p', null, 'Только живые пользователи, никаких ботов')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '💫 Настоящие звезды'),
                    React.createElement('p', null, 'Выигрывайте реальные Telegram Stars')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '⚡ Честная игра'),
                    React.createElement('p', null, 'Прозрачная система и моментальные выплаты')
                )
            )
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

// Compact Game Component
const Game = () => {
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('waiting');
    const [winners, setWinners] = useState([]);
    const [winningNumbers, setWinningNumbers] = useState(null);
    const [bankAmount, setBankAmount] = useState(0);
    const [currentUser, setCurrentUser] = useState(null);
    const [userNumber, setUserNumber] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [syncLoading, setSyncLoading] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const userData = JSON.parse(savedUser);
            setCurrentUser(userData);
        }
        
        initializeGame();
        syncGameState(); // Синхронизируем состояние при загрузке
    }, []);

    // Функция синхронизации состояния игры с сервером
    const syncGameState = async () => {
        if (!currentUser) return;
        
        setSyncLoading(true);
        try {
            const gameData = await API.getCurrentGame();
            console.log('Synced game data:', gameData);
            
            if (gameData && gameData.success) {
                // Обновляем состояние игры с сервера
                if (gameData.game) {
                    setPlayers(gameData.game.players || []);
                    setBankAmount(gameData.game.bankAmount || 0);
                    setGameState(gameData.game.status || 'waiting');
                    
                    // Проверяем, находится ли текущий пользователь в игре
                    const userInGame = gameData.game.players.find(p => 
                        p.telegramId === currentUser.telegramId.toString()
                    );
                    
                    if (userInGame) {
                        setUserNumber(userInGame.number);
                    } else {
                        setUserNumber(null);
                    }
                    
                    // Если игра активна или завершена, обновляем соответствующие состояния
                    if (gameData.game.status === 'active') {
                        // Можно добавить логику для активной игры
                    } else if (gameData.game.status === 'finished' && gameData.game.winningNumbers) {
                        setWinningNumbers(gameData.game.winningNumbers);
                        setWinners(gameData.game.winners || []);
                    }
                }
            }
        } catch (error) {
            console.log('Sync game state failed:', error.message);
            // Игнорируем ошибки синхронизации, используем локальное состояние
        } finally {
            setSyncLoading(false);
        }
    };

    const initializeGame = () => {
        setPlayers([]);
        setBankAmount(0);
        setUserNumber(null);
        setError('');
        setWinners([]);
        setWinningNumbers(null);
    };

    const getUserAvatar = (user) => {
        if (user.avatar && user.avatar !== 'default' && !user.avatar.includes('/i/userpic/320/')) {
            return user.avatar;
        }
        return 'default';
    };

    const joinGame = async () => {
        if (players.length >= 10) {
            setError('Лобби заполнено! Ожидайте следующую игру.');
            return;
        }
        
        // Проверяем, не находится ли пользователь уже в игре (по данным сервера)
        if (userNumber !== null) {
            setError('Вы уже в лобби! Обновляю состояние...');
            await syncGameState();
            return;
        }
        
        if (!currentUser) {
            setError('Ошибка: пользователь не найден');
            return;
        }
        
        if (currentUser.balance < 10) {
            setError('❌ Недостаточно звезд для входа в игру!\n\nНужно: 10 ⭐\nНа балансе: ' + currentUser.balance + ' ⭐\n\nПополните баланс в разделе Профиль.');
            return;
        }
        
        setLoading(true);
        setError('');
        
        try {
            const userAvatar = getUserAvatar(currentUser);
            const userName = currentUser.firstName || 'Игрок';
            
            // Подготавливаем данные для отправки
            const joinData = {
                telegramId: currentUser.telegramId.toString(),
                name: userName,
                avatar: userAvatar,
                balance: currentUser.balance
            };

            console.log('Sending join request:', joinData);

            const result = await API.joinGame(joinData);
            
            if (result.success) {
                // Успешно присоединились - обновляем состояние
                await syncGameState(); // Синхронизируем с сервером
                
                // Обновляем баланс пользователя
                const updatedUser = { 
                    ...currentUser, 
                    balance: result.newBalance || currentUser.balance - 10 
                };
                setCurrentUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                window.dispatchEvent(new CustomEvent('balanceUpdated', {
                    detail: { balance: updatedUser.balance }
                }));
                
                setError('✅ Вы присоединились к игре!');
            } else {
                setError('❌ Не удалось присоединиться к игре');
            }
        } catch (error) {
            console.error('Join game failed:', error);
            
            if (error.message.includes('Already in game')) {
                // Пользователь уже в игре - синхронизируем состояние
                setError('🔄 Вы уже в игре! Обновляю состояние...');
                await syncGameState();
            } else if (error.message.includes('400')) {
                setError('❌ Неверные данные для входа в игру. Проверьте данные пользователя.');
            } else {
                setError('❌ Ошибка соединения с сервером');
            }
        } finally {
            setLoading(false);
        }
    };

    const leaveGame = async () => {
        if (!currentUser) return;
        
        setLoading(true);
        setError('');
        
        try {
            const result = await API.leaveGame(currentUser.telegramId.toString());
            if (result.success) {
                const newBalance = result.newBalance || currentUser.balance + 10;
                const updatedUser = { ...currentUser, balance: newBalance };
                setCurrentUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                window.dispatchEvent(new CustomEvent('balanceUpdated', {
                    detail: { balance: newBalance }
                }));
                
                // Обновляем локальное состояние
                const newPlayers = players.filter(p => p.telegramId !== currentUser.telegramId);
                setPlayers(newPlayers);
                setBankAmount(newPlayers.length * 10);
                setUserNumber(null);
                
                setError('✅ Вы покинули лобби. Возвращено 10 ⭐');
            }
        } catch (error) {
            console.error('Leave game failed:', error);
            
            if (error.message.includes('Not in game')) {
                // Пользователь уже не в игре - обновляем состояние
                setUserNumber(null);
                const newPlayers = players.filter(p => p.telegramId !== currentUser.telegramId);
                setPlayers(newPlayers);
                setError('✅ Вы уже не в игре');
            } else {
                setError('❌ Ошибка при выходе из лобби');
            }
        } finally {
            setLoading(false);
        }
    };

    const startGame = async () => {
        const realPlayersCount = players.filter(p => !p.isBot).length;
        if (realPlayersCount < 2) {
            setError('❌ Нужно минимум 2 реальных игрока! Сейчас: ' + realPlayersCount);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await API.startGame();
            if (result.success) {
                setGameState('active');
                setWinners([]);
                setWinningNumbers(null);
                setError('');
                
                // Синхронизируем состояние после начала игры
                setTimeout(() => syncGameState(), 1000);
            } else {
                setError('❌ Не удалось начать игру');
            }
        } catch (error) {
            console.error('Start game failed:', error);
            setError('❌ Ошибка при запуске игры: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSpinComplete = (winningNums) => {
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
        
        updateUserStats(winnersList);
        
        // Синхронизируем с сервером после завершения игры
        setTimeout(() => syncGameState(), 2000);
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
            
            setError(`🎉 Поздравляем! Вы выиграли ${userWinnings} ⭐`);
        } else if (currentUser) {
            const updatedUser = {
                ...currentUser,
                gamesPlayed: (currentUser.gamesPlayed || 0) + 1
            };
            setCurrentUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setError('😔 В этот раз не повезло. Попробуйте снова!');
        }
    };

    const startNewRound = () => {
        setGameState('waiting');
        setWinners([]);
        setWinningNumbers(null);
        setUserNumber(null);
        setError('');
        initializeGame();
        
        // Синхронизируем с сервером
        setTimeout(() => syncGameState(), 500);
    };

    const handleSyncGame = async () => {
        setError('🔄 Обновляю состояние игры...');
        await syncGameState();
        setError('✅ Состояние игры обновлено!');
    };

    const isUserInGame = userNumber !== null;
    const realPlayersCount = players.filter(p => !p.isBot).length;

    return React.createElement('div', { className: 'game-page' },
        // Кнопка принудительной синхронизации
        React.createElement('div', { style: { textAlign: 'center', marginBottom: '0.5rem' } },
            React.createElement('button', {
                onClick: handleSyncGame,
                disabled: syncLoading,
                style: {
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                }
            }, syncLoading ? '🔄 Синхронизация...' : '🔄 Обновить состояние')
        ),

        error && React.createElement('div', { 
            style: { 
                background: error.includes('✅') || error.includes('🎉') || error.includes('🔄')
                    ? 'rgba(76, 175, 80, 0.2)' 
                    : 'rgba(255, 107, 107, 0.2)',
                border: error.includes('✅') || error.includes('🎉') || error.includes('🔄')
                    ? '1px solid #4caf50'
                    : '1px solid #ff6b6b',
                color: error.includes('✅') || error.includes('🎉') || error.includes('🔄')
                    ? '#4caf50'
                    : '#ff6b6b',
                padding: '0.8rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                fontSize: '0.9rem',
                textAlign: 'center',
                whiteSpace: 'pre-line'
            } 
        }, error),

        gameState === 'waiting' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '👥 Игровое лобби'),
                    React.createElement('div', { className: 'lobby-stats' },
                        React.createElement('p', null, `Игроков: ${realPlayersCount}/10`),
                        React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                        userNumber && 
                            React.createElement('p', null, 
                                `Ваш номер: `,
                                React.createElement('strong', { style: { color: '#ffd700' } }, userNumber)
                            ),
                        realPlayersCount >= 2 && 
                            React.createElement('p', { style: { color: '#4caf50', fontWeight: 'bold' } }, 
                                '✅ Можно начинать!'
                            ),
                        realPlayersCount < 2 &&
                            React.createElement('p', { style: { color: '#ff6b6b' } }, 
                                `❌ Нужно еще ${2 - realPlayersCount} игроков`
                            )
                    ),
                    
                    !isUserInGame ? 
                        React.createElement('button', { 
                            className: 'control-button primary',
                            onClick: joinGame,
                            disabled: players.length >= 10 || loading
                        }, loading ? 'Подключение...' : players.length >= 10 ? 'Лобби заполнено' : `Присоединиться (10 ⭐)`) :
                        React.createElement('div', null,
                            React.createElement('p', { style: { color: '#4caf50', marginBottom: '1rem' } }, 
                                '✅ Вы в игре! Ожидаем других игроков...'
                            ),
                            React.createElement('button', { 
                                className: 'control-button secondary',
                                onClick: leaveGame,
                                disabled: loading
                            }, loading ? 'Выход...' : 'Покинуть лобби')
                        )
                ),

                React.createElement('div', { className: 'players-grid' },
                    players.map(player => 
                        React.createElement('div', { 
                            key: player.id || player.telegramId,
                            className: `player-card ${player.telegramId === currentUser?.telegramId ? 'current-user' : ''}`
                        },
                            React.createElement(UserAvatar, { avatar: player.avatar, size: 'small' }),
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
                ),
                
                isUserInGame && realPlayersCount >= 2 &&
                    React.createElement('div', { className: 'game-controls' },
                        React.createElement('button', { 
                            className: 'control-button primary',
                            onClick: startGame,
                            disabled: loading
                        }, loading ? 'Запуск...' : 'Начать игру')
                    )
            ),

        gameState === 'active' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '🎯 Игра началась!'),
                    React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                    React.createElement('p', { style: { color: '#ffd700' } }, 'Рулетка запускается...')
                ),
                React.createElement(Roulette, { onSpinComplete: handleSpinComplete })
            ),

        gameState === 'finished' &&
            React.createElement('div', { className: 'results-section' },
                React.createElement('div', { className: 'winners-display' },
                    React.createElement('h2', { style: { color: '#ffd700', marginBottom: '1rem' } }, '🎉 Результаты!'),
                    
                    React.createElement('div', { className: 'lobby-stats' },
                        React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                        React.createElement('p', null, `Призы: 50% / 25% / 25%`)
                    ),
                    
                    winningNumbers &&
                        React.createElement('div', { style: { margin: '1rem 0' } },
                            React.createElement('p', { style: { marginBottom: '0.5rem', fontWeight: '600' } }, 'Выигрышные номера:'),
                            React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: '1.5rem', fontSize: '1.1rem' } },
                                React.createElement('div', null, 
                                    React.createElement('strong', null, winningNumbers.left),
                                    React.createElement('div', { style: { fontSize: '0.8rem', opacity: 0.8 } }, '(25%)')
                                ),
                                React.createElement('div', { style: { fontSize: '1.3rem', fontWeight: 'bold' } }, 
                                    React.createElement('strong', null, winningNumbers.center),
                                    React.createElement('div', { style: { fontSize: '0.8rem', opacity: 0.8 } }, '(50%)')
                                ),
                                React.createElement('div', null, 
                                    React.createElement('strong', null, winningNumbers.right),
                                    React.createElement('div', { style: { fontSize: '0.8rem', opacity: 0.8 } }, '(25%)')
                                )
                            )
                        ),
                    
                    winners.length > 0 ? 
                        React.createElement('div', null,
                            React.createElement('p', { style: { margin: '1rem 0 0.5rem 0', fontWeight: '600' } }, 'Победители:'),
                            winners.map((winner, index) => 
                                React.createElement('div', { 
                                    key: `${winner.id || winner.telegramId}-${winner.type}`,
                                    className: `winner-badge ${winner.telegramId === currentUser?.telegramId ? 'current-user' : ''} winner-${winner.type}`
                                },
                                    React.createElement(UserAvatar, { avatar: winner.avatar, size: 'small' }),
                                    React.createElement('div', { className: 'winner-info' },
                                        React.createElement('div', { className: 'winner-name' }, winner.name),
                                        React.createElement('div', { className: 'winner-prize' }, 
                                            `${winner.prize} ⭐ (${winner.prizeType})`
                                        )
                                    )
                                )
                            )
                        ) :
                        React.createElement('div', { className: 'text-center', style: { margin: '1rem 0', opacity: 0.8 } },
                            React.createElement('p', null, 'В этом раунде победителей нет')
                        )
                ),
                
                React.createElement('div', { className: 'game-controls' },
                    React.createElement('button', { 
                        className: 'control-button primary',
                        onClick: startNewRound
                    }, 'Новая игра')
                )
            )
    );
};

// Compact Profile Component (остается без изменений)
const Profile = () => {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({
        gamesPlayed: 0,
        gamesWon: 0,
        totalWinnings: 0
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            setStats({
                gamesPlayed: userData.gamesPlayed || 0,
                gamesWon: userData.gamesWon || 0,
                totalWinnings: userData.totalWinnings || 0
            });
        }
    };

    const handlePayment = async (amount) => {
        if (!user) {
            setError('Пользователь не найден');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await API.demoPayment(user.telegramId, amount);
            if (result.success) {
                const updatedUser = {
                    ...user,
                    balance: result.newBalance || user.balance + amount
                };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                window.dispatchEvent(new CustomEvent('balanceUpdated', {
                    detail: { balance: updatedUser.balance }
                }));
                
                setError(`✅ Баланс пополнен на ${amount} ⭐`);
            } else {
                setError('❌ Ошибка при пополнении баланса');
            }
        } catch (error) {
            console.error('Payment error:', error);
            setError('❌ Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    const winRate = stats.gamesPlayed > 0 ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1) : 0;

    return React.createElement('div', { className: 'profile' },
        error && React.createElement('div', { 
            style: { 
                background: error.includes('✅') 
                    ? 'rgba(76, 175, 80, 0.2)' 
                    : 'rgba(255, 107, 107, 0.2)',
                border: error.includes('✅')
                    ? '1px solid #4caf50'
                    : '1px solid #ff6b6b',
                color: error.includes('✅')
                    ? '#4caf50'
                    : '#ff6b6b',
                padding: '0.8rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                fontSize: '0.9rem',
                textAlign: 'center'
            } 
        }, error),

        React.createElement('div', { className: 'profile-header' },
            React.createElement('h1', null, '👤 Профиль'),
            user && React.createElement('p', { className: 'text-secondary' }, 
                `ID: ${user.telegramId}`
            )
        ),
        
        React.createElement('div', { className: 'stats-grid' },
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Игры'),
                React.createElement('div', { className: 'stat-value' }, stats.gamesPlayed)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Победы'),
                React.createElement('div', { className: 'stat-value' }, stats.gamesWon)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Выигрыш'),
                React.createElement('div', { className: 'stat-value' }, `${stats.totalWinnings}⭐`)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Винрейт'),
                React.createElement('div', { className: 'stat-value' }, `${winRate}%`)
            )
        ),
        
        user && React.createElement('div', { className: 'balance-display' },
            React.createElement('h2', null, '💰 Баланс'),
            React.createElement('div', { 
                className: 'text-accent',
                style: { 
                    fontSize: '2rem', 
                    fontWeight: 'bold',
                    margin: '0.5rem 0'
                } 
            }, `${user.balance} ⭐`)
        ),

        React.createElement('div', { className: 'profile-actions' },
            React.createElement('h2', null, '💫 Пополнить'),
            React.createElement('p', { className: 'text-secondary text-center mb-2' },
                'Выберите сумму для пополнения'
            ),
            React.createElement('div', { className: 'action-buttons' },
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => handlePayment(10),
                    disabled: loading
                }, loading ? 'Обработка...' : '10 ⭐'),
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => handlePayment(50),
                    disabled: loading
                }, loading ? 'Обработка...' : '50 ⭐'),
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => handlePayment(100),
                    disabled: loading
                }, loading ? 'Обработка...' : '100 ⭐')
            )
        )
    );
};

// Main App Component (остается без изменений)
const App = () => {
    const [currentPage, setCurrentPage] = useState('home');
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '') || 'home';
            setCurrentPage(hash);
        };

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            window.Telegram.WebApp.setHeaderColor('#2c2c2c');
            window.Telegram.WebApp.setBackgroundColor('#667eea');
        }

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
        
        setIsInitialized(true);

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const renderPage = () => {
        if (!isInitialized) {
            return React.createElement('div', { className: 'loading' }, 'Загрузка...');
        }

        switch(currentPage) {
            case 'game': 
                return React.createElement(Game);
            case 'profile': 
                return React.createElement(Profile);
            default: 
                return React.createElement(Home);
        }
    };

    return React.createElement('div', { className: 'App' },
        React.createElement(Header, { currentPage }),
        React.createElement('main', null, renderPage())
    );
};

// Error Boundary (остается без изменений)
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('App Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return React.createElement('div', { 
                className: 'text-center',
                style: { 
                    padding: '2rem', 
                    color: 'white'
                } 
            },
                React.createElement('h1', null, '😵 Ошибка'),
                React.createElement('p', { className: 'mb-2' }, 'Пожалуйста, перезагрузите приложение'),
                React.createElement('button', {
                    onClick: () => window.location.reload(),
                    className: 'control-button primary'
                }, 'Перезагрузить')
            );
        }

        return this.props.children;
    }
}

// Modern React 18 rendering
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    React.createElement(ErrorBoundary, null,
        React.createElement(App)
    )
);
