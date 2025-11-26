window.onload = async function() { // 注意这里加了 async
    // --- Supabase 动态初始化 ---
   const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabaseUrl = 'https://dudqpldnkjdsvwrwills.supabase.co';
    const supabaseAnonKey = 'sb_secret_GyZwiD9zNIzVuSn1ymx_QA_5v-jRncc';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // --- 全局变量 ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');

    // 游戏配置
    const gridSize = 20;
    const tileCount = canvas.width / gridSize;

    let snake = [{x: 10, y: 10}];
    let food = {};
    let dx = 0;
    let dy = 0;
    let score = 0;
    let playerName = ''; // 存储玩家昵称
    let gameLoop = null; // 用于存储游戏循环的ID

    // --- 昵称和游戏启动逻辑 ---
    const nameModal = document.getElementById('nameModal');
    const playerNameInput = document.getElementById('playerNameInput');
    const startGameBtn = document.getElementById('startGameBtn');

    startGameBtn.addEventListener('click', async () => {
        const name = playerNameInput.value.trim();
        if (name) {
            playerName = name;
            nameModal.style.display = 'none';
            await fetchAndDisplayLeaderboard();
            startGame();
        } else {
            alert('昵称不能为空！');
        }
    });

    // --- 游戏控制函数 ---
    function startGame() {
        randomFood();
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(drawGame, 100);
    }

    // --- Supabase 交互函数 ---
    async function uploadScore(name, playerScore) {
        const { error } = await supabase
            .from('leaderboard')
            .insert([{ player_name: name, score: playerScore }]);
        
        if (error) {
            console.error('上传分数失败:', error);
        } else {
            console.log('分数上传成功!');
        }
    }

    async function fetchAndDisplayLeaderboard() {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('player_name, score')
            .order('score', { ascending: false })
            .limit(15);

        if (error) {
            console.error('获取排行榜失败:', error);
            return;
        }

        const oldLeaderboardElement = document.getElementById('leaderboard');
        if (oldLeaderboardElement) oldLeaderboardElement.remove();

        const leaderboardElement = document.createElement('div');
        leaderboardElement.id = 'leaderboard';
        leaderboardElement.innerHTML = '<h2>排行榜 (前15名)</h2>';

        const list = document.createElement('ol');
        data.forEach(entry => {
            const item = document.createElement('li');
            item.textContent = `${entry.player_name}: ${entry.score}`;
            list.appendChild(item);
        });

        leaderboardElement.appendChild(list);
        document.querySelector('.score-container').after(leaderboardElement);
    }

    // --- 游戏核心逻辑 ---
    function randomFood() {
        food = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
    }

    function drawGame() {
        clearCanvas();
        moveSnake();
        
        if (checkGameOver()) {
            resetGame();
            return;
        }

        checkFoodCollision();
        drawFood();
        drawSnake();
    }

    function clearCanvas() {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    function moveSnake() {
        const head = {x: snake[0].x + dx, y: snake[0].y + dy};
        snake.unshift(head);
    }

    function checkGameOver() {
        const head = snake[0];
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
            return true;
        }
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                return true;
            }
        }
        return false;
    }

    function checkFoodCollision() {
        const head = snake[0];
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            scoreElement.textContent = score;
            randomFood();
        } else {
            snake.pop();
        }
    }

    function drawSnake() {
        ctx.fillStyle = 'lime';
        for (let segment of snake) {
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
        }
    }

    function drawFood() {
        ctx.fillStyle = 'red';
        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
    }

    async function resetGame() {
        if (gameLoop) clearInterval(gameLoop);
        
        if (score > 0) {
            await uploadScore(playerName, score);
        }

        await fetchAndDisplayLeaderboard();
        
        snake = [{x: 10, y: 10}];
        dx = 0;
        dy = 0;
        score = 0;
        scoreElement.textContent = score;
        
        if (confirm(`游戏结束! 你的得分是 ${score}。是否重新开始？`)) {
            startGame();
        }
    }

    function changeDirection(keyCode) {
        const goingUp = dy === -1;
        const goingDown = dy === 1;
        const goingRight = dx === 1;
        const goingLeft = dx === -1;

        if (keyCode === 37 && !goingRight) { // LEFT
            dx = -1; dy = 0;
        }
        if (keyCode === 38 && !goingDown) { // UP
            dx = 0; dy = -1;
        }
        if (keyCode === 39 && !goingLeft) { // RIGHT
            dx = 1; dy = 0;
        }
        if (keyCode === 40 && !goingUp) { // DOWN
            dx = 0; dy = 1;
        }
    }

    // --- 事件监听 ---
    document.addEventListener('keydown', (event) => {
        changeDirection(event.keyCode);
    });

    document.getElementById('upButton').addEventListener('click', () => changeDirection(38));
    document.getElementById('downButton').addEventListener('click', () => changeDirection(40));
    document.getElementById('leftButton').addEventListener('click', () => changeDirection(37));
    document.getElementById('rightButton').addEventListener('click', () => changeDirection(39));
    
    const buttons = document.querySelectorAll('.controls button');
    buttons.forEach(button => {
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const id = e.target.id;
            switch(id) {
                case 'upButton': changeDirection(38); break;
                case 'downButton': changeDirection(40); break;
                case 'leftButton': changeDirection(37); break;
                case 'rightButton': changeDirection(39); break;
            }
        });
    });
};
