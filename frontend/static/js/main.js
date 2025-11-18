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

  async leaveGame(telegramId) {
    return this.request('/game/leave', {
      method: 'POST',
      body: JSON.stringify({ telegramId }),
    });
  },

  async getUserProfile(telegramId) {
    return this.request(`/user/profile/${telegramId}`);
  },

  async updateBalance(telegramId, amount) {
    return this.request('/user/balance', {
      method: 'POST',
      body: JSON.stringify({ telegramId, amount }),
    });
  }
};

// Header Component
const Header = () => {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(1000);
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
                console.error('Telegram auth failed, using fallback:', error);
                loadFallbackUser();
            }
        } else {
            loadFallbackUser();
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

    const loadFallbackUser = () => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            setBalance(userData.balance);
            setUserAvatar(userData.avatar || '👤');
        } else {
            const demoUser = {
                telegramId: 'demo-user',
                firstName: 'Demo',
                lastName: 'User',
                username: 'demo',
                balance: 1000,
                avatar: '🤖'
            };
            setUser(demoUser);
            setBalance(demoUser.balance);
            setUserAvatar(demoUser.avatar);
            localStorage.setItem('user', JSON.stringify(demoUser));
        }
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
            React.createElement('p', null, 'Моментальная лотерея с реальными игроками из Telegram!'),
            React.createElement('p', null, 'Получи номер от 1 до 10 и выигрывай звезды вместе с другими игроками!'),
            React.createElement('button', { 
                className: 'cta-button',
                onClick: () => navigateTo('game')
            }, 'Начать играть')
        ),
        React.createElement('div', { className: 'how-to-play' },
            React.createElement('h2', null, 'Как играть?'),
            React.createElement('ol', null,
                React.createElement('li', null, 'Нажмите "Начать играть" чтобы присоединиться к лобби'),
                React.createElement('li', null, 'Каждому игроку присваивается уникальный номер от 1 до 10'),
                React.createElement('li', null, 'Когда набирается 10 игроков - игра начинается автоматически'),
                React.createElement('li', null, 'Запускается анимированная рулетка'),
                React.createElement('li', null, 'Определяются 3 выигрышных номера'),
                React.createElement('li', null, 'Победители получают звезды на свой баланс')
            ),
            React.createElement('p', { style: { marginTop: '1rem', fontWeight: 'bold', textAlign: 'center' } }, 
                'Призы: Главный приз - 50% банка, дополнительные - по 25% банка!'
            )
        ),
        React.createElement('div', { className: 'features' },
            React.createElement('h2', null, 'Почему выбирают нас?'),
            React.createElement('div', { className: 'features-grid' },
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '👥 Реальные игроки'),
                    React.createElement('p', null, 'Играйте с реальными пользователями из Telegram')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '⭐ Звезды'),
                    React.createElement('p', null, 'Выигрывайте настоящие звезды которые можно вывести')
                ),
                React.createElement('div', { className: 'feature-card' },
                    React.createElement('h3', null, '⚡ Моментально'),
                    React.createElement('p', null, 'Результаты сразу после заполнения лобби')
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
    const [botsAdded, setBotsAdded] = useState(0);
    const [currentUser, setCurrentUser] = useState(null);
    const [userNumber, setUserNumber] = useState(null);

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

    useEffect(() => {
        if (gameState !== 'waiting') return;
        
        const botInterval = setInterval(() => {
            addBotPlayer();
        }, 2000);
        
        return () => clearInterval(botInterval);
    }, [gameState, players]);

    useEffect(() => {
        if (players.length === 10 && gameState === 'waiting') {
            console.log('Достигнуто 10 игроков, запускаем игру через 3 секунды...');
            const timer = setTimeout(() => {
                startGame();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [players.length, gameState]);

    const syncGameState = async () => {
        try {
            const gameData = await API.getCurrentGame();
            if (gameData && gameData.players) {
                setPlayers(gameData.players);
                setBankAmount(gameData.bankAmount || 0);
                setGameState(gameData.status || 'waiting');
                
                const userPlayer = gameData.players.find(p => 
                    p.telegramId === (currentUser?.telegramId || 'demo-user')
                );
                if (userPlayer) {
                    setUserNumber(userPlayer.number);
                }
            }
        } catch (error) {
            console.log('Using local game state:', error.message);
        }
    };

    const initializeGame = () => {
        setPlayers([]);
        setBankAmount(0);
        setJoinTime(Date.now());
        setBotsAdded(0);
        setUserNumber(null);
        console.log('Игра инициализирована');
    };

    const addBotPlayer = () => {
        if (players.length >= 10 || gameState !== 'waiting') return;
        
        const currentPlayerCount = players.length;
        const hasCurrentUser = players.find(p => !p.isBot);
        
        if (!hasCurrentUser && currentPlayerCount === 0) return;
        
        const freeNumbers = getFreeNumbers(players);
        if (freeNumbers.length === 0) return;
        
        const botNumber = freeNumbers[0];
        const botAvatars = ['🤖', '👾', '🤡', '💀', '👻', '🐵', '🐸', '🦁', '🐲', '🦄'];
        const botNames = ['Бот_Алекс', 'Бот_Макс', 'Бот_Даня', 'Бот_Саша', 'Бот_Костя', 'Бот_Ник', 'Бот_Майк', 'Бот_Джон'];
        
        const botAvatar = botAvatars[botsAdded % botAvatars.length];
        const botName = botNames[botsAdded % botNames.length];
        
        const newBot = {
            id: `bot-${Date.now()}-${Math.random()}`,
            telegramId: `bot-${botsAdded + 1}`,
            name: botName,
            number: botNumber,
            avatar: botAvatar,
            isBot: true
        };
        
        const newPlayers = [...players, newBot];
        setPlayers(newPlayers);
        setBankAmount(calculateBank(newPlayers.length));
        setBotsAdded(prev => prev + 1);
        
        console.log(`Добавлен бот ${botName} #${botNumber}. Всего игроков: ${newPlayers.length}`);
    };

    const calculateBank = (playerCount) => {
        return playerCount * 10;
    };

    const getFreeNumbers = (currentPlayers) => {
        const usedNumbers = currentPlayers.map(p => p.number);
        return [1,2,3,4,5,6,7,8,9,10].filter(num => !usedNumbers.includes(num));
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
        
        if (players.find(p => !p.isBot)) {
            alert('Вы уже в лобби!');
            return;
        }
        
        if (!currentUser) {
            alert('Ошибка: пользователь не найден');
            return;
        }
        
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
            console.error('Backend join failed, using local mode:', error);
            joinGameLocal();
        }
    };

    const joinGameLocal = () => {
        const freeNumbers = getFreeNumbers(players);
        if (freeNumbers.length === 0) {
            alert('Нет свободных номеров!');
            return;
        }
        
        const userNumber = freeNumbers[Math.floor(Math.random() * freeNumbers.length)];
        const userAvatar = getUserAvatar(currentUser);
        const userName = currentUser.firstName || 'Вы';
        
        const userPlayer = {
            id: 'current-user',
            telegramId: currentUser.telegramId,
            name: userName,
            number: userNumber,
            avatar: userAvatar,
            isBot: false
        };
        
        const newBalance = currentUser.balance - 10;
        const updatedUser = { 
            ...currentUser, 
            balance: newBalance,
            avatar: userAvatar 
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        const newPlayers = [...players, userPlayer];
        setPlayers(newPlayers);
        setBankAmount(calculateBank(newPlayers.length));
        setUserNumber(userNumber);
        setJoinTime(Date.now());
        
        window.dispatchEvent(new CustomEvent('balanceUpdated', {
            detail: { balance: newBalance }
        }));
        
        console.log('Пользователь присоединился с номером', userNumber);
        alert(`✅ Вы присоединились к игре! Ваш номер: ${userNumber}\nСписано: 10 ⭐`);
    };

    const leaveGame = async () => {
        const userPlayer = players.find(p => !p.isBot);
        if (userPlayer) {
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
                    
                    alert(`Вы покинули лобби. Возвращено: 10 ⭐`);
                }
            } catch (error) {
                console.error('Backend leave failed, using local mode:', error);
                // Local fallback
                const newBalance = currentUser.balance + 10;
                const updatedUser = { ...currentUser, balance: newBalance };
                setCurrentUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                window.dispatchEvent(new CustomEvent('balanceUpdated', {
                    detail: { balance: newBalance }
                }));
                
                alert(`Вы покинули лобби. Возвращено: 10 ⭐`);
            }
        }
        
        const newPlayers = players.filter(p => p.isBot);
        setPlayers(newPlayers);
        setBankAmount(calculateBank(newPlayers.length));
        setUserNumber(null);
        console.log('Пользователь покинул лобби');
    };

    const startGame = async () => {
  console.log('🔄 Attempting to start game...');
  
  // Локальная проверка перед запросом к API
  if (players.length < 2) {
    alert('❌ Нужно минимум 2 игрока для начала игры! Сейчас: ' + players.length);
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
      // Используем локальный запуск если API не сработал
      startGameLocal();
    }
  } catch (error) {
    console.error('❌ API start failed, using local mode:', error);
    
    // Показываем детальную ошибку от сервера
    if (error.message.includes('400')) {
      try {
        const errorResponse = await error.response?.json();
        if (errorResponse?.details) {
          alert(`❌ ${errorResponse.error}\n${errorResponse.details}`);
        } else {
          alert('❌ Не удалось начать игру: недостаточно игроков на сервере');
        }
      } catch {
        alert('❌ Не удалось начать игру: недостаточно игроков');
      }
    } else {
      // Используем локальный запуск как fallback
      startGameLocal();
    }
  }
};

const startGameLocal = () => {
  console.log('🎮 Starting game locally...');
  
  if (players.length < 2) {
    alert('❌ Нужно минимум 2 игрока для начала игры! Сейчас: ' + players.length);
    return;
  }

  console.log('=== НАЧАЛО ИГРЫ (локально) ===');
  setGameState('active');
  setWinners([]);
  setWinningNumbers(null);
  
  // Логируем детали для отладки
  console.log('Players in local start:', players);
  console.log('Real players:', players.filter(p => !p.isBot).length);
  console.log('Bots:', players.filter(p => p.isBot).length);
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
            .filter(winner => !winner.isBot && winner.telegramId === currentUser?.telegramId)
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

    const isUserInGame = players.some(p => !p.isBot);
    const timeInLobby = joinTime ? Math.floor((Date.now() - joinTime) / 1000) : 0;

    console.log('=== ТЕКУЩЕЕ СОСТОЯНИЕ ===');
    console.log('Game State:', gameState);
    console.log('Players:', players.length);
    console.log('User in game:', isUserInGame);
    console.log('User number:', userNumber);
    console.log('Bank:', bankAmount);

    return React.createElement('div', { className: 'game-page' },
        gameState === 'waiting' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'room-info' },
                    React.createElement('h2', null, '👥 Игровое лобби'),
                    React.createElement('div', { className: 'lobby-stats' },
                        React.createElement('p', null, `Игроков: ${players.length}/10`),
                        React.createElement('p', null, `Банк: ${bankAmount} ⭐`),
                        userNumber && 
                            React.createElement('p', null, 
                                `Ваш номер: `,
                                React.createElement('strong', { style: { color: '#ffd700', fontSize: '1.2em' } }, userNumber)
                            ),
                        React.createElement('p', { style: { fontSize: '0.9rem', opacity: 0.7 } }, 
                            `В лобби: ${Math.floor(timeInLobby / 60)}:${(timeInLobby % 60).toString().padStart(2, '0')}`
                        ),
                        players.length === 10 && 
                            React.createElement('p', { style: { color: '#ff6b6b', fontWeight: 'bold', animation: 'pulse 1s infinite' } }, 
                                '🎯 Игра начнется через 3 секунды...'
                            )
                    ),
                    
                    !isUserInGame ? 
                        React.createElement('button', { 
                            className: 'control-button primary',
                            onClick: joinGame,
                            disabled: players.length >= 10
                        }, players.length >= 10 ? 'Лобби заполнено' : `Присоединиться к игре (10 ⭐)`) :
                        React.createElement('div', null,
                            React.createElement('p', { style: { color: '#4caf50', marginBottom: '1rem' } }, 
                                '✅ Вы в игре! Ожидаем других игроков...'
                            ),
                            players.length < 10 && 
                                React.createElement('p', { style: { color: '#ffd700', marginBottom: '1rem' } }, 
                                    `До начала игры: ${10 - players.length} игроков`
                                ),
                            React.createElement('button', { 
                                className: 'control-button secondary',
                                onClick: leaveGame
                            }, 'Покинуть лобби (вернуть 10 ⭐)')
                        )
                ),

                React.createElement('div', { className: 'players-grid' },
                    players.map(player => 
                        React.createElement('div', { 
                            key: player.id || player.telegramId,
                            className: `player-card ${!player.isBot ? 'current-user' : ''} ${player.isBot ? 'bot-player' : ''}`
                        },
                            React.createElement('div', { 
                                className: 'player-avatar',
                                style: { 
                                    fontSize: player.isBot ? '1.5rem' : '2rem',
                                    animation: !player.isBot ? 'pulse 2s infinite' : 'none'
                                }
                            }, player.avatar),
                            React.createElement('div', { className: 'player-name' }, player.name),
                            React.createElement('div', { className: 'player-number' }, `#${player.number}`),
                            !player.isBot && React.createElement('div', { 
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
                    React.createElement('p', null, `Игроков: ${players.length}`),
                    React.createElement('p', { style: { color: '#ffd700' } }, 'Рулетка запускается автоматически...')
                ),
                React.createElement(Roulette, { onSpinComplete: handleSpinComplete })
            ),

        gameState === 'finished' &&
            React.createElement('div', { className: 'results-section' },
                React.createElement('div', { className: 'winners-display' },
                    React.createElement('h2', { style: { color: '#ffd700', marginBottom: '1rem' } }, '🎉 Результаты раунда! 🎉'),
                    
                    React.createElement('div', { className: 'bank-info' },
                        React.createElement('p', null, `Общий банк: ${bankAmount} ⭐`),
                        React.createElement('p', null, `Распределение: 50% / 25% / 25%`)
                    ),
                    
                    winningNumbers &&
                        React.createElement('div', { className: 'winning-numbers-info' },
                            React.createElement('div', { 
                                style: { 
                                    background: 'linear-gradient(135deg, #ffd700, #ff6b00)',
                                    color: '#333',
                                    padding: '1rem 2rem',
                                    borderRadius: '15px',
                                    margin: '1rem auto',
                                    maxWidth: '500px'
                                } 
                            },
                                React.createElement('h3', { style: { marginBottom: '0.5rem' } }, 'Выигрышные номера:'),
                                React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '1.2rem' } },
                                    React.createElement('div', null, 
                                        React.createElement('strong', null, winningNumbers.left),
                                        React.createElement('br'),
                                        '(25%)'
                                    ),
                                    React.createElement('div', { style: { fontSize: '1.4rem', fontWeight: 'bold' } }, 
                                        React.createElement('strong', null, winningNumbers.center),
                                        React.createElement('br'),
                                        '(50%)'
                                    ),
                                    React.createElement('div', null, 
                                        React.createElement('strong', null, winningNumbers.right),
                                        React.createElement('br'),
                                        '(25%)'
                                    )
                                )
                            )
                        ),
                    
                    winners.length > 0 ? 
                        React.createElement('div', null,
                            React.createElement('h3', { style: { margin: '1.5rem 0 1rem 0', color: '#4caf50' } }, 'Победители:'),
                            winners.map((winner, index) => 
                                React.createElement('div', { 
                                    key: `${winner.id || winner.telegramId}-${winner.type}`,
                                    className: `winner-badge ${!winner.isBot ? 'current-user' : ''} winner-${winner.type}`
                                },
                                    React.createElement('div', { className: 'winner-avatar' }, winner.avatar),
                                    React.createElement('div', { className: 'winner-info' },
                                        React.createElement('div', { className: 'winner-name' }, winner.name),
                                        React.createElement('div', { className: 'winner-prize' }, 
                                            `${winner.prizeType}: ${winner.prize} ⭐`
                                        )
                                    )
                                )
                            )
                        ) :
                        React.createElement('div', { className: 'no-winners' },
                            React.createElement('p', null, 'В этом раунде победителей нет'),
                            React.createElement('p', { style: { marginTop: '0.5rem', opacity: 0.8 } }, 
                                'Никто не угадал выигрышные номера'
                            )
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

// Profile Component
const Profile = () => {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({
        gamesPlayed: 0,
        gamesWon: 0,
        totalWinnings: 0
    });

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
            
            if (userData.telegramId && userData.telegramId !== 'demo-user') {
                try {
                    const result = await API.getUserProfile(userData.telegramId);
                    if (result.success) {
                        setUser(result.user);
                        setStats({
                            gamesPlayed: result.user.gamesPlayed || 0,
                            gamesWon: result.user.gamesWon || 0,
                            totalWinnings: result.user.totalWinnings || 0
                        });
                        localStorage.setItem('user', JSON.stringify(result.user));
                    }
                } catch (error) {
                    console.log('Using local profile data:', error.message);
                }
            }
        }
    };

    const updateBalance = async (amount) => {
        if (!user) return;
        
        try {
            if (user.telegramId && user.telegramId !== 'demo-user') {
                const result = await API.updateBalance(user.telegramId, amount);
                if (result.success) {
                    const updatedUser = { ...user, balance: result.newBalance };
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    
                    window.dispatchEvent(new CustomEvent('balanceUpdated', {
                        detail: { balance: result.newBalance }
                    }));
                    
                    alert(`Баланс пополнен на ${amount} ⭐!`);
                    return;
                }
            }
        } catch (error) {
            console.log('Using local balance update:', error.message);
        }
        
        const newBalance = user.balance + amount;
        const updatedUser = { ...user, balance: newBalance };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        window.dispatchEvent(new CustomEvent('balanceUpdated', {
            detail: { balance: newBalance }
        }));
        
        alert(`Баланс пополнен на ${amount} ⭐!`);
    };

    return React.createElement('div', { className: 'profile' },
        React.createElement('div', { className: 'profile-header' },
            React.createElement('h1', null, '👤 Ваш профиль'),
            user && React.createElement('p', { style: { marginTop: '0.5rem', opacity: 0.8 } }, 
                `ID: ${user.telegramId}${user.telegramId === 'demo-user' ? ' (демо режим)' : ''}`
            )
        ),
        
        React.createElement('div', { className: 'stats-grid' },
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Сыграно игр'),
                React.createElement('div', { className: 'stat-value' }, stats.gamesPlayed)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Выиграно игр'),
                React.createElement('div', { className: 'stat-value' }, stats.gamesWon)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Общий выигрыш'),
                React.createElement('div', { className: 'stat-value' }, `${stats.totalWinnings} ⭐`)
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('h3', null, 'Процент побед'),
                React.createElement('div', { className: 'stat-value' },
                    stats.gamesPlayed > 0 
                        ? `${((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1)}%`
                        : '0%'
                )
            )
        ),
        
        user && React.createElement('div', { className: 'balance-display' },
            React.createElement('h2', null, '💰 Текущий баланс'),
            React.createElement('div', { 
                style: { 
                    fontSize: '2.5rem', 
                    fontWeight: 'bold', 
                    color: '#ffd700',
                    textAlign: 'center',
                    margin: '1rem 0'
                } 
            }, `${user.balance} ⭐`)
        ),

        React.createElement('div', { className: 'profile-actions' },
            React.createElement('h2', null, 'Действия'),
            React.createElement('div', { className: 'action-buttons' },
                React.createElement('button', { 
                    className: 'control-button primary',
                    onClick: () => updateBalance(100)
                }, 'Пополнить баланс (+100 ⭐)'),
                React.createElement('button', { 
                    className: 'control-button secondary',
                    onClick: () => {
                        alert('Функция вывода средств в разработке');
                    }
                }, 'Вывести звезды'),
                React.createElement('button', { 
                    className: 'control-button',
                    onClick: () => {
                        alert('История игр в разработке');
                    }
                }, 'История игр')
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
            console.log('Telegram Web App initialized');
        }

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
        
        setIsInitialized(true);

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const renderPage = () => {
        if (!isInitialized) {
            return React.createElement('div', { className: 'loading' }, 'Загрузка приложения...');
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
                style: { 
                    padding: '2rem', 
                    textAlign: 'center',
                    color: 'white'
                } 
            },
                React.createElement('h1', null, '😵 Произошла ошибка'),
                React.createElement('p', null, 'Пожалуйста, перезагрузите приложение'),
                React.createElement('button', {
                    onClick: () => window.location.reload(),
                    style: {
                        padding: '1rem 2rem',
                        background: '#ff6b6b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        marginTop: '1rem'
                    }
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


