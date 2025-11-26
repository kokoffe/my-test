window.onload = async function() {
    // --- 1. 基础初始化（Supabase + DOM元素获取）---
    // 动态导入Supabase客户端
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    // Supabase配置（保持原配置不变）
    const supabaseUrl = 'https://dudqpldnkjdsvwrwills.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1ZHFwbGRua2pkc3Z3cndpbGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjA1NjAsImV4cCI6MjA3OTY5NjU2MH0.FaWgUWgosKNos-dIqrW4avOiq7Xfp1YpxH7QiCqAtcM';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 获取DOM元素（含新增的道具提示元素）
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const gameTipElement = document.getElementById('gameTip'); // 游戏状态提示
    const propTipElement = document.getElementById('propTip'); // 道具效果提示
    const leaderboardContainer = document.getElementById('leaderboardContainer'); // 排行榜容器
    const leaderboardLoading = document.getElementById('leaderboardLoading'); // 排行榜加载状态
    const leaderboardElement = document.getElementById('leaderboard'); // 排行榜列表

    // --- 2. 游戏核心配置与全局变量 ---
    const gridSize = 20; // 每个格子大小（像素）
    let tileCount; // 画布横向/纵向格子数（响应式计算）
    
    // 游戏基础状态变量
    let snake = [{ x: 10, y: 10 }];
    let food = {};
    let dx = 0; // 水平方向速度（-1左，1右，0静止）
    let dy = 0; // 垂直方向速度（-1上，1下，0静止）
    let score = 0;
    let playerName = ''; // 玩家昵称
    let gameLoop = null; // 游戏循环ID（控制暂停/结束）

    // ===== 新增：道具系统核心变量 =====
    let prop = null; // 当前道具（null=无道具）
    const propTypes = { // 3种道具配置：颜色+效果+持续时间
        speedUp: { // 加速道具：提升速度+得分翻倍
            color: '#ffd700', // 金色
            borderColor: '#ff9900', // 橙色边框
            effect: () => {
                const oldInterval = 100; // 原基础速度（100ms/帧）
                clearInterval(gameLoop);
                gameLoop = setInterval(drawGame, 60); // 提速至60ms/帧
                scoreMultiplier = 2; // 得分×2
                showPropTip('加速生效！得分×2（持续5秒）');
                // 5秒后恢复默认状态
                setTimeout(() => {
                    clearInterval(gameLoop);
                    gameLoop = setInterval(drawGame, oldInterval);
                    scoreMultiplier = 1;
                    showPropTip('加速效果结束');
                }, 5000);
            },
            duration: 5000
        },
        speedDown: { // 减速道具：降低速度，操作更灵活
            color: '#4169e1', // 蓝色
            borderColor: '#191970', // 深蓝色边框
            effect: () => {
                const oldInterval = 100;
                clearInterval(gameLoop);
                gameLoop = setInterval(drawGame, 150); // 减速至150ms/帧
                showPropTip('减速生效！操作更灵活（持续5秒）');
                // 5秒后恢复默认状态
                setTimeout(() => {
                    clearInterval(gameLoop);
                    gameLoop = setInterval(drawGame, oldInterval);
                    showPropTip('减速效果结束');
                }, 5000);
            },
            duration: 5000
        },
        invincible: { // 无敌道具：撞墙/撞自己不死亡，仅扣1节
            color: '#ff4500', // 橙红色
            borderColor: '#dc143c', // 深红色边框
            effect: () => {
                isInvincible = true; // 开启无敌状态
                showPropTip('无敌生效！撞墙/撞自己仅扣1节（持续4秒）');
                // 4秒后关闭无敌
                setTimeout(() => {
                    isInvincible = false;
                    showPropTip('无敌效果结束');
                }, 4000);
            },
            duration: 4000
        }
    };
    let scoreMultiplier = 1; // 得分倍数（默认×1）
    let isInvincible = false; // 无敌状态标记（默认关闭）
    let propTimer = null; // 道具过期定时器（5秒未吃自动消失）
    let foodGenerateCount = 0; // 普通食物生成计数（控制道具生成概率）

    // --- 3. 昵称模态框与游戏启动逻辑 ---
    const nameModal = document.getElementById('nameModal');
    const playerNameInput = document.getElementById('playerNameInput');
    const startGameBtn = document.getElementById('startGameBtn');

    // 从localStorage读取历史昵称（实现“记住昵称”功能）
    playerName = localStorage.getItem('snakePlayerName') || '';

    // 初始化流程：有昵称直接进游戏，无昵称显示模态框
    if (playerName) {
        nameModal.style.display = 'none';
        await fetchAndDisplayLeaderboard(); // 加载排行榜
        startGame(); // 初始化游戏（等待用户操作）
    } else {
        nameModal.style.display = 'flex';
        playerNameInput.focus(); // 输入框自动聚焦
    }

    // 昵称确认按钮点击事件
    startGameBtn.addEventListener('click', async () => {
        const inputName = playerNameInput.value.trim();
        if (inputName) {
            playerName = inputName;
            localStorage.setItem('snakePlayerName', playerName); // 保存昵称
            nameModal.style.display = 'none';
            await fetchAndDisplayLeaderboard();
            startGame();
        } else {
            alert('请输入有效的昵称（最多10个字符）！');
            playerNameInput.focus();
        }
    });

    // 昵称输入框支持回车键确认
    playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            startGameBtn.click();
        }
    });

    // --- 4. 游戏控制核心函数 ---
    /**
     * 初始化/重置游戏状态（含道具状态重置）
     */
    function startGame() {
        // 1. 重置基础游戏数据
        snake = [{ x: 10, y: 10 }];
        dx = 0;
        dy = 0;
        score = 0;
        scoreElement.textContent = score;
        tileCount = Math.floor(canvas.width / gridSize); // 响应式计算格子数
        randomFood(); // 生成初始食物/道具
        
        // 2. 重置道具相关状态
        if (propTimer) clearTimeout(propTimer); // 清除道具过期定时器
        prop = null; // 清空当前道具
        scoreMultiplier = 1; // 得分倍数恢复×1
        isInvincible = false; // 关闭无敌
        foodGenerateCount = 0; // 重置食物生成计数
        propTipElement.style.opacity = '0'; // 隐藏道具提示
        
        // 3. 清除旧循环，标记为“未启动”
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = null; 
        
        // 4. 显示“等待开始”提示，绘制初始画面
        gameTipElement.textContent = '按方向键或点击按钮开始游戏';
        gameTipElement.style.opacity = '1';
        drawGame();
    }

    /**
     * 游戏结束后重置流程（含分数上传、排行榜更新）
     */
    async function resetGame() {
        // 1. 停止游戏循环
        if (gameLoop) clearInterval(gameLoop);
        const finalScore = score; // 保存最终得分

        // 2. 显示游戏结束提示
        gameTipElement.textContent = `游戏结束！最终得分：${finalScore}`;
        gameTipElement.style.opacity = '1';

        // 3. 分数>0时上传到Supabase
        if (finalScore > 0) {
            await uploadScore(playerName, finalScore);
            await fetchAndDisplayLeaderboard(); // 上传后刷新排行榜
        }

        // 4. 询问用户是否重新开始
        const isRestart = confirm(`游戏结束！你的得分：${finalScore}\n是否重新开始游戏？`);
        if (isRestart) {
            startGame();
        } else {
            // 不重新开始时，清空画布并显示提示
            clearCanvas();
            gameTipElement.textContent = '点击“方向键”或“按钮”重新开始';
            gameTipElement.style.opacity = '1';
        }
    }

    // --- 5. Supabase数据交互函数（分数上传+排行榜）---
    /**
     * 上传玩家分数到Supabase
     * @param {string} name - 玩家昵称
     * @param {number} playerScore - 玩家得分
     */
    async function uploadScore(name, playerScore) {
        try {
            const { error } = await supabase
                .from('leaderboard')
                .insert([{ player_name: name, score: playerScore }]);
            
            if (error) throw error;
            console.log(`分数上传成功：${name} - ${playerScore}分`);
        } catch (error) {
            console.error('分数上传失败：', error.message);
        }
    }

    /**
     * 从Supabase获取排行榜并渲染（带加载状态）
     */
    async function fetchAndDisplayLeaderboard() {
        // 1. 显示加载状态
        leaderboardLoading.style.display = 'flex';
        leaderboardElement.innerHTML = '';

        try {
            const { data, error } = await supabase
                .from('leaderboard')
                .select('player_name, score')
                .order('score', { ascending: false })
                .limit(15);

            if (error) throw error;

            // 2. 处理无数据场景
            if (data.length === 0) {
                leaderboardElement.innerHTML = '<li class="empty-leaderboard">暂无排行榜数据，快来成为第一个上榜者吧！</li>';
                return;
            }

            // 3. 渲染排行榜（前三名带奖牌标记）
            const olList = document.createElement('ol');
            data.forEach((entry, index) => {
                const liItem = document.createElement('li');
                if (index === 0) liItem.innerHTML = `<span class="rank top1">🥇</span> ${entry.player_name}：${entry.score}分`;
                else if (index === 1) liItem.innerHTML = `<span class="rank top2">🥈</span> ${entry.player_name}：${entry.score}分`;
                else if (index === 2) liItem.innerHTML = `<span class="rank top3">🥉</span> ${entry.player_name}：${entry.score}分`;
                else liItem.innerHTML = `<span class="rank">${index + 1}</span> ${entry.player_name}：${entry.score}分`;
                olList.appendChild(liItem);
            });
            leaderboardElement.appendChild(olList);

        } catch (error) {
            console.error('排行榜加载失败：', error.message);
            leaderboardElement.innerHTML = '<li class="error-leaderboard">排行榜加载失败，请刷新页面重试！</li>';
        } finally {
            // 4. 无论成功/失败，隐藏加载状态
            leaderboardLoading.style.display = 'none';
        }
    }

    // --- 6. 游戏画面绘制与逻辑计算 ---
    /**
     * 清空Canvas画布
     */
    function clearCanvas() {
        ctx.fillStyle = '#000'; // 黑色背景（匹配深色主题）
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * 随机生成普通食物/道具（道具生成规则：每3次食物15%概率）
     */
    function randomFood() {
        foodGenerateCount++;
        let isOverlap;

        // 判定是否生成道具（每3次普通食物，15%概率）
        const isPropGenerate = foodGenerateCount % 3 === 0 && Math.random() < 0.15;
        if (isPropGenerate) {
            // 随机选择一种道具类型
            const propKeys = Object.keys(propTypes);
            const randomPropKey = propKeys[Math.floor(Math.random() * propKeys.length)];
            
            // 生成道具坐标（避免与蛇身重叠）
            do {
                isOverlap = false;
                prop = {
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount),
                    type: randomPropKey,
                    config: propTypes[randomPropKey]
                };
                // 检查道具是否与蛇身重叠
                snake.forEach(segment => {
                    if (segment.x === prop.x && segment.y === prop.y) isOverlap = true;
                });
            } while (isOverlap);

            // 道具5秒后自动消失
            if (propTimer) clearTimeout(propTimer);
            propTimer = setTimeout(() => {
                prop = null;
                showPropTip('道具已过期');
            }, 5000);
            foodGenerateCount = 0; // 重置计数，避免连续生成道具

        } else {
            // 生成普通食物（避免与蛇身重叠）
            do {
                isOverlap = false;
                food = {
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount)
                };
                // 检查食物是否与蛇身重叠
                snake.forEach(segment => {
                    if (segment.x === food.x && segment.y === food.y) isOverlap = true;
                });
            } while (isOverlap);
        }
    }

    /**
     * 显示道具效果提示（3秒后自动隐藏）
     * @param {string} text - 提示文本
     */
    function showPropTip(text) {
        propTipElement.textContent = text;
        propTipElement.style.opacity = '1';
        setTimeout(() => {
            propTipElement.style.opacity = '0';
        }, 3000);
    }

    /**
     * 绘制道具（带边框，区分普通食物）
     */
    function drawProp() {
        if (!prop) return; // 无道具时不绘制
        const { x, y, config } = prop;
        
        // 绘制道具主体
        ctx.fillStyle = config.color;
        ctx.fillRect(
            x * gridSize + 1,
            y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );
        
        // 绘制道具边框（突出显示）
        ctx.strokeStyle = config.borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(
            x * gridSize + 1,
            y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );
    }

    /**
     * 绘制蛇（绿色格子，带间距）
     */
    function drawSnake() {
        ctx.fillStyle = '#39ff14'; // 亮绿色蛇身
        snake.forEach(segment => {
            ctx.fillRect(
                segment.x * gridSize + 1,
                segment.y * gridSize + 1,
                gridSize - 2,
                gridSize - 2
            );
        });
    }

    /**
     * 绘制食物（红色格子，带间距）
     */
    function drawFood() {
        ctx.fillStyle = '#ff6b6b'; // 亮红色食物
        ctx.fillRect(
            food.x * gridSize + 1,
            food.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );
    }

    /**
     * 移动蛇（更新蛇头位置，处理蛇身跟随）
     */
    function moveSnake() {
        // 计算新蛇头位置
        const head = { x: snake[0].x + dx, y: snake[0].y + dy };
        // 新蛇头加入蛇身头部
        snake.unshift(head);
        // 未吃到食物/道具时，删除蛇尾（实现移动效果）
        if (!(head.x === food.x && head.y === food.y) && !(prop && head.x === prop.x && head.y === prop.y)) {
            snake.pop();
        }
    }

    /**
     * 检查游戏是否结束（撞墙/撞自己）
     * @returns {boolean} - true=游戏结束，false=继续
     */
    function checkGameOver() {
        const head = snake[0];
        // 1. 撞墙检测
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
            return true;
        }
        // 2. 撞自己检测
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查碰撞（普通食物/道具）
     */
    function checkFoodCollision() {
        const head = snake[0];
        // 1. 先检测道具碰撞
        if (prop && head.x === prop.x && head.y === prop.y) {
            prop.config.effect(); // 触发道具效果
            prop = null; // 道具被吃后清空
            if (propTimer) clearTimeout(propTimer); // 清除道具过期定时器
            return;
        }
        // 2. 再检测普通食物碰撞（得分×倍数）
        if (head.x === food.x && head.y === food.y) {
            score += 10 * scoreMultiplier;
            scoreElement.textContent = score;
            randomFood(); // 生成新食物/道具
        }
    }

    /**
     * 游戏主绘制循环（控制画面更新与逻辑执行）
     */
    function drawGame() {
        clearCanvas();

        // 未启动游戏时：只绘制静态画面（蛇+食物+道具）
        if (gameLoop === null) {
            drawFood();
            drawProp();
            drawSnake();
            return;
        }

        // 已启动游戏：执行完整逻辑
        moveSnake();
        // 无敌状态下碰撞：不结束游戏，仅扣1节身体
        if (checkGameOver()) {
            if (isInvincible) {
                snake.pop(); // 扣1节身体
                showPropTip('无敌保护！扣除1节身体');
                return;
            } else {
                resetGame();
                return;
            }
        }
        checkFoodCollision();
        drawFood();
        drawProp();
        drawSnake();
    }

    // --- 7. 输入控制（键盘+触摸+按钮）---
    /**
     * 处理方向控制（防止反向移动）
     * @param {number} keyCode - 键盘码（37左/38上/39右/40下）
     */
    function changeDirection(keyCode) {
        // 第一次操作：启动游戏循环，隐藏“等待开始”提示
        if (gameLoop === null) {
            gameLoop = setInterval(drawGame, 100); // 基础速度100ms/帧
            gameTipElement.style.opacity = '0';
        }

        // 方向控制（防止反向移动）
        const goingUp = dy === -1;
        const goingDown = dy === 1;
        const goingLeft = dx === -1;
        const goingRight = dx === 1;

        if (keyCode === 37 && !goingRight) { // 左
            dx = -1;
            dy = 0;
        }
        if (keyCode === 38 && !goingDown) { // 上
            dx = 0;
            dy = -1;
        }
        if (keyCode === 39 && !goingLeft) { // 右
            dx = 1;
            dy = 0;
        }
        if (keyCode === 40 && !goingUp) { // 下
            dx = 0;
            dy = 1;
        }
    }

    // 键盘方向键控制（阻止页面滚动）
    document.addEventListener('keydown', (e) => {
        if ([37, 38, 39, 40].includes(e.keyCode)) {
            e.preventDefault();
            changeDirection(e.keyCode);
        }
    });

    // 屏幕按钮点击控制
    document.getElementById('upButton').addEventListener('click', () => changeDirection(38));
    document.getElementById('downButton').addEventListener('click', () => changeDirection(40));
    document.getElementById('leftButton').addEventListener('click', () => changeDirection(37));
    document.getElementById('rightButton').addEventListener('click', () => changeDirection(39));

    // 移动端触摸控制（避免触摸延迟）
    const controlButtons = document.querySelectorAll('.control-btn');
    controlButtons.forEach(button => {
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            switch (button.id) {
                case 'upButton': changeDirection(38); break;
                case 'downButton': changeDirection(40); break;
                case 'leftButton': changeDirection(37); break;
                case 'rightButton': changeDirection(39); break;
            }
        });
    });

    // --- 8. 响应式适配（窗口大小变化时重新计算）---
    window.addEventListener('resize', () => {
        if (canvas) {
            tileCount = Math.floor(canvas.width / gridSize);
            // 未启动游戏时，重新绘制画面
            if (gameLoop === null) {
                drawGame();
            }
        }
    });
};