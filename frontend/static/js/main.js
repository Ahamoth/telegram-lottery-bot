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
        throw new Error(`HTTP error! status: ${response.status}`);
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

  // Демо-платежи
  async demoPayment(telegramId, amount) {
    return this.request('/payment/demo-payment', {
      method: 'POST',
      body: JSON.stringify({ telegramId, amount }),
    });
  },

  // История платежей
  async getPaymentHistory(telegramId, limit = 10) {
    return this.request(`/payment/history/${telegramId}?limit=${limit}`);
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
                alert('❌ Ошибка авторизации. Пожалуйста, откройте приложение через Telegram бота.');
            }
        } else {
            alert('❌ Это приложение работает только внутри Telegram. Пожалуйста, откройте через бота.');
        }
    };

    const generateTelegramAvatar = (tgUser) => {
        if (!tgUser) return '👤';
        
        const emojiAvatars = ['😊', '😎', '🤠', '👨‍💻', '👩‍💻', '🦊', '🐯', '🐶', '🐱', '🐼'];
        
        if (tgUser.username) {
            const firstChar = tgUser.username.charAt(0).toUpperCase();
            const emojiIndex = firstChar.charCodeAt(0) % emojiAvatars.length;
            return emojiAvatars[emojiIndex];
        } else if (tgUser.first_name) {
            const firstChar = tgUser.first_name.charAt(0).toUpperCase();
            const emojiIndex = firstChar.charCodeAt(0) % emojiAvatars.length;
            return emojiAvatars[emojiIndex];
        }
        
        return '👤';
    };

    const navigateTo = (page) => {
        window.location.hash = page;
    };

    return React.createElement('header', { className: 'header' },
        React.createElement('div', { className: 'logo' }, '🎰 Счастливый Номер'),
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
            React.createElement('div', { className: 'user-avatar' }, userAvatar),
            React.createElement('div', { className: 'balance' }, `Баланс: ${balance} ⭐`)
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
            React.createElement('h1', null, '🎰 Счастливый Номер'),
            React.createElement('p', null, 'Реальная лотерея с Telegram Stars!'),
            React.createElement('p', null, 'Получи номер от 1 до 10 и выигрывай настоящие звезды с реальными игроками!'),
            React.createElement('button', { 
                className: 'cta-button',
                onClick: () => navigateTo('game')
            }, 'Начать играть')
        ),
        React.createElement('div', { className: 'how-to-play' },
            React.createElement('h2', null, '🎯 Как играть?'),
            React.createElement('ol', null,
                React.createElement('li', null, 'Пополните баланс звездами в разделе Профиль'),
                React.createElement('li', null, 'Нажмите "Начать играть" чтобы присоединиться к лобби'),
                React.createElement('li', null, 'Каждому игроку присваивается уникальный номер от 1 до 10'),
                React.createElement('li', null, 'Когда набирается 2+ реальных игроков - игра начинается'),
                React.createElement('li', null, 'Запускается анимированная рулетка'),
                React.createElement('li', null, 'Определяются 3 выигрышных номера'),
                React.createElement('li', null, 'Победители получают реальные звезды на баланс')
            ),
            React.createElement('p', { style: { marginTop: '1rem', fontWeight: 'bold', textAlign: 'center' } }, 
                '💰 Призы: Главный приз - 50% банка, дополнительные - по 25% банка!'
            ),
            React.createElement('p', { style: { marginTop: '0.5rem', textAlign: 'center', color: '#ffd700' } }, 
                '🎮 Вход в игру: 10 ⭐ с игрока'
            )
        ),
        React.createElement('div', { className: 'features' },
            React.createElement('h2', null, '⭐ Почему выбирают нас?'),
            React.createElement('div', { className: 'features-grid' },
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '👥 Только реальные игроки'),
                    React.createElement('p', null, 'Играйте с реальными пользователями из Telegram. Никаких ботов!')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '💫 Настоящие звезды'),
                    React.createElement('p', null, 'Выигрывайте и проигрывайте реальные Telegram Stars')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '⚡ Честная игра'),
                    React.createElement('p', null, 'Прозрачная система розыгрыша и моментальные выплаты')
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
                        font-size: 24px; font-weight: bold; color: white;
                        border: 8px solid #ffd700; box-shadow: 0 0 30px rgba(255,215,0,0.5);
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
        console.log('Игра инициализирована');
    };

    const getUserAvatar = (user) => {
        if (user.avatar) return user.avatar;
        
        const emojiAvatars = ['😊', '😎', '🤠', '👨‍💻', '👩‍💻', '🦊', '🐯', '🐶', '🐱', '🐼'];
        if (user.firstName) {
            const firstChar = user.firstName.charAt(0).toUpperCase();
            const emojiIndex = firstChar.charCodeAt(0) % emojiAvatars.length;
            return emojiAvatars[emojiIndex];
        }
        return '👤';
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
            if (error.message.includes('400')) {
                try {
                    const errorResponse = await error.response?.json();
                    alert(`❌ ${errorResponse.error}`);
                } catch {
                    alert('❌ Не удалось присоединиться к игре');
                }
            } else {
                alert('❌ Ошибка соединения с сервером');
            }
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
        console.log('🔄 Attempting to start game...');
        
        // Локальная проверка перед запросом к API
        const realPlayersCount = players.filter(p => !p.isBot).length;
        if (realPlayersCount < 2) {
            alert('❌ Нужно минимум 2 реальных игрока для начала игры! Сейчас: ' + realPlayersCount);
            return;
        }

        try {
            console.log('🚀 Sending start request to API...');
            const result = await API.startGame();
            
            if (result.success) {
                console.log('✅ Game started successfully via API');
                setGameState('active');
                setWinners([]);
                setWinningNumbers(null);
            } else {
                console.warn('⚠️ API returned success: false', result);
                alert('❌ Не удалось начать игру');
            }
        } catch (error) {
            console.error('❌ API start failed:', error);
            
            // Показываем детальную ошибку от сервера
            if (error.message.includes('400')) {
                try {
                    const errorResponse = await error.response?.json();
                    if (errorResponse?.details) {
                        alert(`❌ ${errorResponse.error}\n${errorResponse.details}`);
                    } else {
                        alert('❌ Не удалось начать игру: недостаточно игроков');
                    }
                } catch {
                    alert('❌ Не удалось начать игру: недостаточно игроков');
                }
            } else {
                alert('❌ Ошибка соединения с сервером');
            }
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
        console.log('Новый раунд');
        setGameState('waiting');
        setWinners([]);
        setWinningNumbers(null);
        setUserNumber(null);
        initializeGame();
    };

    const isUserInGame = players.some(p => p.telegramId === currentUser?.telegramId);
    const timeInLobby = joinTime ? Math.floor((Date.now() - joinTime) / 1000) : 0;
    const realPlayersCount = players.filter(p => !p.isBot).length;

    console.log('=== ТЕКУЩЕЕ СОСТОЯНИЕ ===');
    console.log('Game State:', gameState);
    console.log('Players:', players.length);
    console.log('Real Players:', realPlayersCount);
    console.log('User in game:', isUserInGame);
    console.log('User number:', userNumber);
    console.log('Bank:', bankAmount);

    return React.createElement('div', { className: 'game-page' },
        gameState === 'waiting' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '👥 Игровое лобби'),
                    React.createElement('div', { className: 'lobby-stats' },
                        React.createElement('p', null, `Реальных игроков: ${realPlayersCount}/10`),
                        React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                        userNumber && 
                            React.createElement('p', null, 
                                `Ваш номер: `,
                                React.createElement('strong', { style: { color: '#ffd700', fontSize: '1.2em' } }, userNumber)
                            ),
                        React.createElement('p', { style: { fontSize: '0.9rem', opacity: 0.7 } }, 
                            `В лобби: ${Math.floor(timeInLobby / 60)}:${(timeInLobby % 60).toString().padStart(2, '0')}`
                        ),
                        realPlayersCount >= 2 && 
                            React.createElement('p', { style: { color: '#4caf50', fontWeight: 'bold' } }, 
                                '✅ Достаточно игроков для начала игры!'
                            ),
                        realPlayersCount < 2 &&
                            React.createElement('p', { style: { color: '#ff6b6b', fontWeight: 'bold' } }, 
                                `❌ Нужно еще ${2 - realPlayersCount} игроков для начала`
                            )
                    ),
                    
                    !isUserInGame ? 
                        React.createElement('button', { 
                            className: 'control-button primary',
                            onClick: joinGame,
                            disabled: players.length >= 10 || loading
                        }, loading ? 'Подключение...' : players.length >= 10 ? 'Лобби заполнено' : `Присоединиться к игре (10 ⭐)`) :
                        React.createElement('div', null,
                            React.createElement('p', { style: { color: '#4caf50', marginBottom: '1rem' } }, 
                                '✅ Вы в игре! Ожидаем других игроков...'
                            ),
                            realPlayersCount < 2 && 
                                React.createElement('p', { style: { color: '#ffd700', marginBottom: '1rem' } }, 
                                    `До начала игры: ${2 - realPlayersCount} игроков`
                                ),
                            React.createElement('button', { 
                                className: 'control-button secondary',
                                onClick: leaveGame,
                                disabled: loading
                            }, loading ? 'Выход...' : 'Покинуть лобби (вернуть 10 ⭐)')
                        )
                ),

                React.createElement('div', { className: 'players-grid' },
                    players.map(player => 
                        React.createElement('div', { 
                            key: player.id || player.telegramId,
                            className: `player-card ${player.telegramId === currentUser?.telegramId ? 'current-user' : ''}`
                        },
                            React.createElement('div', { 
                                className: 'player-avatar',
                                style: { 
                                    fontSize: '2rem',
                                    animation: player.telegramId === currentUser?.telegramId ? 'pulse 2s infinite' : 'none'
                                }
                            }, player.avatar),
                            React.createElement('div', { className: 'player-name' }, player.name),
                            React.createElement('div', { className: 'player-number' }, `#${player.number}`),
                            player.telegramId === currentUser?.telegramId && React.createElement('div', { 
                                className: 'player-badge',
                                style: { 
                                    background: '#ffd700', 
                                    color: '#333',
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    marginTop: '5px',
                                    fontWeight: 'bold'
                                }
                            }, 'Вы')
                        )
                    ),
                    
                    ...Array.from({ length: 10 - players.length }, (_, index) => 
                        React.createElement('div', { 
                            key: `empty-${index}`,
