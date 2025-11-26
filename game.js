window.onload = async function() {
    // --- Supabase 动态初始化 ---
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabaseUrl = 'https://dudqpldnkjdsvwrwills.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1ZHFwbGRua2pkc3Z3cndpbGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjA1NjAsImV4cCI6MjA3OTY5NjU2MH0.FaWgUWgosKNos-dIqrW4avOiq7Xfp1YpxH7QiCqAtcM';
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
    
    // 从 localStorage 获取昵称，如果没有则为 null
    playerName = localStorage.getItem('snakePlayerName');

    // 检查是否已有昵称
    if (playerName) {
        // 如果有昵称，隐藏模态框，直接准备游戏
        nameModal.style.display = 'none';
        await fetchAndDisplayLeaderboard();
        startGame(); // 准备好游戏，等待用户按键
    } else {
        // 如果没有昵称，显示模态框，等待用户输入
        nameModal.style.display = 'flex';
    }

    startGameBtn.addEventListener('click', async () => {
        const name = playerNameInput.value.trim();
        if (name) {
            playerName = name;
            // 将昵称存入 localStorage
            localStorage.setItem('snakePlayerName', playerName);
            nameModal.style.display = 'none';
            await fetchAndDisplayLeaderboard();
            startGame(); // 准备好游戏，等待用户按键
        } else {
            alert('昵称不能为空！');
        }
    });

    // --- 游戏控制函数 ---
    function startGame() {
        // 重置游戏状态，但不立即开始主循环
        snake = [{x: 10, y: 10}];
        dx = 0;
        dy = 0;
        score = 0;
        scoreElement.textContent = score;
        randomFood();
        
        // 清除可能存在的旧循环
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = null; // 标记为未开始

        // 绘制初始画面
        drawGame(); 
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
        
        // 如果游戏还没开始（即玩家还没按方向键），则只绘制静态画面，不进行移动和碰撞检测
        if (gameLoop === null) {
            drawFood();
            drawSnake();
            return;
        }

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

    // ================== 修改后的函数 ==================
    async function resetGame() {
        if (gameLoop) clearInterval(gameLoop);
        
        // 1. 在重置 score 之前，将其保存到临时变量
        const finalScore = score;

        if (finalScore > 0) {
            // 2. 使用临时变量上传分数
            await uploadScore(playerName, finalScore);
        }

        await fetchAndDisplayLeaderboard();
        
        // 3. 重置游戏状态
        startGame(); 
        
        // 4. 使用临时变量显示最终得分
        if (confirm(`游戏结束! 你的得分是 ${finalScore}。是否重新开始？`)) {
            // 游戏已经通过 startGame() 准备好了，等待用户按键
        } else {
            // 如果用户不重新开始，可以清空画布
            clearCanvas();
        }
    }
    // =================================================

    function changeDirection(keyCode) {
        // 如果游戏循环还没开始，说明这是第一次按键，启动游戏
        if (gameLoop === null) {
            gameLoop = setInterval(drawGame, 100);
        }

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
