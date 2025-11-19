const { useState, useEffect, useRef } = React;

// API service — ОБНОВЛЁННЫЙ
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
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
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

  async leaveGame(telegramId) {
    return this.request('/game/leave', {
      method: 'POST',
      body: JSON.stringify({ telegramId }),
    });
  },

  async getUserProfile(telegramId) {
    return this.request(`/user/profile/${telegramId}`);
  },

  // НОВЫЙ МЕТОД — создаём ссылку на оплату Stars
  async createStarsInvoiceLink(telegramId, amount) {
    return this.request('/payment/create-invoice-link', {
      method: 'POST',
      body: JSON.stringify({ telegramId, amount }),
    });
  },

  // Демо-платежи (оставляем для теста)
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
    border: '2px solid rgba(255, 215, 0, 0.5)',
    background: 'linear-gradient(135deg, #667eea, #764ba2)'
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
          font-size: ${size === 'large' ? '18px' : size === 'normal' ? '16px' : '12px'};
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
        fontSize: size === 'large' ? '18px' : size === 'normal' ? '16px' : '12px',
        fontWeight: 'bold'
      }
    }, '👤');
  }
};

// Header Component
const Header = () => {
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
                
                const avatar = generateTelegramAvatar(tgUser);
                setUserAvatar(avatar);
                
                const result = await API.authenticate(initData);
                
                if (result.success) {
                    const userWithAvatar = {
                        ...result.user,
                        avatar: avatar
                    };
                    setUser(userWithAvatar);
                    setBalance(result.user.balance);
                    localStorage.setItem('user', JSON.stringify(userWithAvatar));
                    
                    window.dispatchEvent(new CustomEvent('userAuthenticated', {
                        detail: { user: userWithAvatar }
                    }));
                }
            } catch (error) {
                console.error('Telegram auth failed:', error);
            }
        }
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

    return React.createElement('header', { className: 'header' },
        React.createElement('div', { className: 'logo' }, '🎰 Lucky Number'),
        React.createElement('nav', null,
            React.createElement('ul', { className: 'nav-links' },
                React.createElement('li', null, 
                    React.createElement('a', { 
                        href: '#home',
                        onClick: (e) => { e.preventDefault(); navigateTo('home'); }
                    }, 'Главная')
                ),
                React.createElement('li', null, 
                    React.createElement('a', { 
                        href: '#game',
                        onClick: (e) => { e.preventDefault(); navigateTo('game'); }
                    }, 'Играть')
                ),
                React.createElement('li', null, 
                    React.createElement('a', { 
                        href: '#profile',
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
                
                const userPlayer = gameData.players.find(p => 
                    p.telegramId === (currentUser?.telegramId)
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
        
        if (players.find(p => p.telegramId === currentUser?.telegramId)) {
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
        
        const newPlayers = players.filter(p => p.telegramId !== currentUser.telegramId);
        setPlayers(newPlayers);
        setBankAmount(calculateBank(newPlayers.length));
        setUserNumber(null);
    };

    const calculateBank = (playerCount) => {
        return playerCount * 10;
    };

    const startGame = async () => {
        const realPlayersCount = players.filter(p => !p.isBot).length;
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

    const isUserInGame = players.some(p => p.telegramId === currentUser?.telegramId);
    const timeInLobby = joinTime ? Math.floor((Date.now() - joinTime) / 1000) : 0;
    const realPlayersCount = players.filter(p => !p.isBot).length;

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

// В компоненте Profile заменяем функцию handleTelegramPayment
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
        } catch (err) {
            console.error('Failed to load profile:', err);
        }
    };

    useEffect(() => {
        loadUserData();
        const interval = setInterval(loadUserData, 8000);
        return () => clearInterval(interval);
    }, []);

    // НОВАЯ ФУНКЦИЯ ОПЛАТЫ — РАБОТАЕТ С createInvoiceLink
    const handleTelegramPayment = async (amount) => {
        if (!user || loading) return;
        setLoading(true);

        try {
            // Шаг 1: Запрашиваем ссылку на оплату у бэкенда
            const result = await API.createStarsInvoiceLink(user.telegramId, amount);

            if (!result.success || !result.invoice_link) {
                throw new Error('Не удалось создать ссылку на оплату');
            }

            // Шаг 2: Открываем оплату через Telegram (самый надёжный способ)
            window.location.href = result.invoice_link;

            // Альтернатива (если в будущем Telegram добавит openInvoice в WebApp):
            // if (Telegram.WebApp.openInvoice) {
            //   Telegram.WebApp.openInvoice(result.invoice_link);
            // } else {
            //   window.location.href = result.invoice_link;
            // }

            // После оплаты Telegram сам закроет окно и вернёт пользователя в Mini App
            // Баланс обновится автоматически через polling или successful_payment в боте

        } catch (error) {
            console.error('Payment error:', error);
            
            // Если ошибка — пробуем демо-режим (только для теста!)
            if (confirm('❌ Оплата не удалась. Использовать демо-режим?')) {
                try {
                    const demoResult = await API.demoPayment(user.telegramId, amount);
                    if (demoResult.success) {
                        alert(`✅ Демо: +${amount} ⭐`);
                        loadUserData();
                        window.dispatchEvent(new CustomEvent('balanceUpdated', {
                            detail: { balance: demoResult.newBalance }
                        }));
                    }
                } catch (demoErr) {
                    alert('❌ Даже демо не сработал :(');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return React.createElement('div', { className: 'profile' },
        React.createElement('div', { className: 'profile-header' },
            React.createElement('h1', null, 'Профиль'),
            user && React.createElement('p', { style: { marginTop: '0.5rem', opacity: 0.8, fontSize: '0.9rem' } }, 
                `ID: ${user.telegramId}`
            )
        ),
        
        React.createElement('div', { className: 'stats-grid' },
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Сыграно'),
                React.createElement('div', { className: 'stat-value' }, stats.gamesPlayed)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Победы'),
                React.createElement('div', { className: 'stat-value' }, stats.gamesWon)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Выиграно'),
                React.createElement('div', { className: 'stat-value' }, `${stats.totalWinnings}⭐`)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Процент'),
                React.createElement('div', { className: 'stat-value' },
                    stats.gamesPlayed > 0 
                        ? `${((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(0)}%`
                        : '0%'
                )
            )
        ),
        
        user && React.createElement('div', { className: 'balance-display' },
            React.createElement('h2', null, 'Баланс'),
            React.createElement('div', { className: 'balance-value' }, `${user.balance} ⭐`)
        ),

        React.createElement('div', { className: 'profile-actions' },
            React.createElement('h2', null, 'Пополнить баланс'),
            React.createElement('div', { className: 'action-buttons' },
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => handleTelegramPayment(10),
                    disabled: loading
                }, loading ? '...' : '10 ⭐'),
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => handleTelegramPayment(50),
                    disabled: loading
                }, loading ? '...' : '50 ⭐'),
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => handleTelegramPayment(100),
                    disabled: loading
                }, loading ? '...' : '100 ⭐'),
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => handleTelegramPayment(500),
                    disabled: loading
                }, loading ? '...' : '500 ⭐')
            ),
            React.createElement('p', { style: { fontSize: '0.8rem', opacity: 0.7, marginTop: '1rem' } },
                'Оплата через Telegram Stars — безопасно и мгновенно ⭐'
            )
        )
    );
};

// Main App Component
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
        React.createElement(Header),
        React.createElement('main', null, renderPage())
    );
};

// Error Boundary
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
                className: 'loading'
            },
                React.createElement('h1', null, '😵 Ошибка'),
                React.createElement('p', null, 'Перезагрузите приложение'),
                React.createElement('button', {
                    onClick: () => window.location.reload(),
                    className: 'control-button primary',
                    style: { marginTop: '1rem' }
                }, 'Обновить')
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

