window.onload = async function() {
    // --- 1. 基础初始化：Supabase 配置 + DOM 元素获取 ---
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    // Supabase 原有配置（保持不变）
    const supabaseUrl = 'https://dudqpldnkjdsvwrwills.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1ZHFwbGRua2pkc3Z3cndpbGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjA1NjAsImV4cCI6MjA3OTY5NjU2MH0.FaWgUWgosKNos-dIqrW4avOiq7Xfp1YpxH7QiCqAtcM';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 获取所有DOM元素（含道具提示）
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const gameTipElement = document.getElementById('gameTip');
    const propTipElement = document.getElementById('propTip');
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    const leaderboardLoading = document.getElementById('leaderboardLoading');
    const leaderboardElement = document.getElementById('leaderboard');
    const nameModal = document.getElementById('nameModal');
    const playerNameInput = document.getElementById('playerNameInput');
    const startGameBtn = document.getElementById('startGameBtn');


    // --- 2. 游戏核心配置：解决地图小、蛇太大问题 ---
    const gridSize = 20; // 每个格子尺寸（20px，不变）
    let tileCount; // 地图格子数（最小20个，避免地图过小）

    // 初始化Canvas尺寸：基础400x400px，自适应窗口且有最小/最大限制
    function initCanvasSize() {
        const baseSize = 400; // 基础尺寸（对应20个格子）
        // 窗口宽度-40避免超出屏幕，同时不小于基础尺寸、不大于600px
        const canvasSize = Math.min(600, Math.max(baseSize, window.innerWidth - 40));
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        // 样式控制：居中+最小宽度，防止缩太小
        canvas.style.minWidth = `${baseSize}px`;
        canvas.style.maxWidth = '600px';
        canvas.style.margin = '0 auto';
        canvas.style.display = 'block';
        // 计算格子数（最小20个，确保地图足够大）
        tileCount = Math.max(20, Math.floor(canvas.width / gridSize));
    }

    // 游戏状态变量：蛇初始3节（避免太小/太大），且居中显示
    let snake = [
        { x: Math.floor(tileCount/2), y: Math.floor(tileCount/2) }, // 蛇头（居中）
        { x: Math.floor(tileCount/2) - 1, y: Math.floor(tileCount/2) }, // 蛇身1
        { x: Math.floor(tileCount/2) - 2, y: Math.floor(tileCount/2) }  // 蛇身2
    ];
    let food = {}; // 普通食物
    let dx = 0; // 水平方向（-1左，1右，0静止）
    let dy = 0; // 垂直方向（-1上，1下，0静止）
    let score = 0; // 当前分数
    let playerName = ''; // 玩家昵称
    let gameLoop = null; // 游戏循环定时器

    // 道具系统配置：降低道具频率，避免抢占食物
    let prop = null; // 当前道具（null=无）
    const propTypes = {
        speedUp: { // 加速道具：金色+橙色边框
            color: '#ffd700',
            borderColor: '#ff9900',
            effect: () => {
                const oldInterval = 100; // 原速度（100ms/帧）
                clearInterval(gameLoop);
                gameLoop = setInterval(drawGame, 60); // 提速至60ms/帧
                scoreMultiplier = 2; // 得分×2
                showPropTip('加速生效！得分×2（5秒）');
                // 5秒后恢复
                setTimeout(() => {
                    clearInterval(gameLoop);
                    gameLoop = setInterval(drawGame, oldInterval);
                    scoreMultiplier = 1;
                    showPropTip('加速效果结束');
                }, 5000);
            },
            duration: 5000
        },
        speedDown: { // 减速道具：蓝色+深蓝色边框
            color: '#4169e1',
            borderColor: '#191970',
            effect: () => {
                const oldInterval = 100;
                clearInterval(gameLoop);
                gameLoop = setInterval(drawGame, 150); // 减速至150ms/帧
                showPropTip('减速生效！操作更灵活（5秒）');
                // 5秒后恢复
                setTimeout(() => {
                    clearInterval(gameLoop);
                    gameLoop = setInterval(drawGame, oldInterval);
                    showPropTip('减速效果结束');
                }, 5000);
            },
            duration: 5000
        },
        invincible: { // 无敌道具：橙红色+深红色边框
            color: '#ff4500',
            borderColor: '#dc143c',
            effect: () => {
                isInvincible = true; // 开启无敌
                showPropTip('无敌生效！撞墙仅扣1节（4秒）');
                // 4秒后关闭
                setTimeout(() => {
                    isInvincible = false;
                    showPropTip('无敌效果结束');
                }, 4000);
            },
            duration: 4000
        }
    };
    let scoreMultiplier = 1; // 得分倍数（默认×1）
    let isInvincible = false; // 无敌状态标记
    let propTimer = null; // 道具过期定时器
    // 道具生成规则：每5次普通食物，20%概率生成（降低频率，避免食物断层）
    let foodGenerateCount = 0;
    const PROP_INTERVAL = 5; // 每5次食物尝试生成道具
    const PROP_RATE = 0.2; // 20%生成概率


    // --- 3. 昵称模态框逻辑：初始化地图+游戏 ---
    // 读取本地存储的昵称
    playerName = localStorage.getItem('snakePlayerName') || '';

    // 初始化流程：有昵称直接进游戏，无昵称显示模态框
    if (playerName) {
        nameModal.style.display = 'none';
        initCanvasSize(); // 初始化地图尺寸
        await fetchAndDisplayLeaderboard(); // 加载排行榜
        startGame(); // 启动游戏
    } else {
        nameModal.style.display = 'flex';
        playerNameInput.focus();
        initCanvasSize(); // 模态框显示时也初始化地图（避免异常）
    }

    // 昵称确认按钮点击事件
    startGameBtn.addEventListener('click', async () => {
        const inputName = playerNameInput.value.trim();
        if (inputName && inputName.length <= 10) { // 限制昵称长度
            playerName = inputName;
            localStorage.setItem('snakePlayerName', playerName);
            nameModal.style.display = 'none';
            initCanvasSize();
            await fetchAndDisplayLeaderboard();
            startGame();
        } else {
            alert('请输入1-10个字符的有效昵称！');
            playerNameInput.focus();
        }
    });

    // 昵称输入框按回车确认
    playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') startGameBtn.click();
    });


    // --- 4. 游戏核心控制：启动/重置 ---
    /**
     * 启动/重置游戏：恢复初始状态，生成初始食物
     */
    function startGame() {
        // 重置蛇：居中显示，3节长度
        snake = [
            { x: Math.floor(tileCount/2), y: Math.floor(tileCount/2) },
            { x: Math.floor(tileCount/2) - 1, y: Math.floor(tileCount/2) },
            { x: Math.floor(tileCount/2) - 2, y: Math.floor(tileCount/2) }
        ];
        dx = 0;
        dy = 0;
        score = 0;
        scoreElement.textContent = score;

        // 重置道具状态
        if (propTimer) clearTimeout(propTimer);
        prop = null;
        scoreMultiplier = 1;
        isInvincible = false;
        foodGenerateCount = 0;
        propTipElement.style.opacity = '0';

        // 生成初始食物（确保游戏开始时有食物）
        randomFood();

        // 重置游戏循环
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = null;

        // 显示开始提示
        gameTipElement.textContent = '按方向键或点击按钮开始游戏';
        gameTipElement.style.opacity = '1';
        drawGame(); // 初始绘制
    }

    /**
     * 游戏结束：上传分数+提示重新开始
     */
    async function resetGame() {
        clearInterval(gameLoop); // 停止循环
        const finalScore = score;

        // 显示结束提示
        gameTipElement.textContent = `游戏结束！最终得分：${finalScore}`;
        gameTipElement.style.opacity = '1';

        // 分数>0时上传到Supabase
        if (finalScore > 0) {
            await uploadScore(playerName, finalScore);
            await fetchAndDisplayLeaderboard(); // 刷新排行榜
        }

        // 询问是否重新开始
        const isRestart = confirm(`得分：${finalScore}\n是否重新开始游戏？`);
        if (isRestart) startGame();
        else {
            clearCanvas(); // 清空画布
            gameTipElement.textContent = '点击“方向键”或“按钮”重新开始';
            gameTipElement.style.opacity = '1';
        }
    }


    // --- 5. Supabase 交互：分数上传+排行榜 ---
    /**
     * 上传分数到Supabase
     * @param {string} name - 玩家昵称
     * @param {number} score - 最终得分
     */
    async function uploadScore(name, score) {
        try {
            const { error } = await supabase
                .from('leaderboard')
                .insert([{ player_name: name, score: score }]);
            if (error) throw error;
            console.log(`分数上传成功：${name} - ${score}分`);
        } catch (error) {
            console.error('分数上传失败：', error.message);
            alert('分数上传失败，请稍后再试！');
        }
    }

    /**
     * 从Supabase获取排行榜并渲染
     */
    async function fetchAndDisplayLeaderboard() {
        leaderboardLoading.style.display = 'flex';
        leaderboardElement.innerHTML = '';

        try {
            // 获取Top15分数（按分数降序，相同分数按时间升序）
            const { data, error } = await supabase
                .from('leaderboard')
                .select('player_name, score, created_at')
                .order('score', { ascending: false })
                .order('created_at', { ascending: true })
                .limit(15);

            if (error) throw error;

            // 无数据时显示提示
            if (data.length === 0) {
                leaderboardElement.innerHTML = '<li class="empty-leaderboard">暂无排行榜数据，快来成为第一个上榜者吧！</li>';
                return;
            }

            // 渲染排行榜（前三名带奖牌标记）
            const olList = document.createElement('ol');
            data.forEach((item, index) => {
                const li = document.createElement('li');
                // 格式化时间（YYYY-MM-DD HH:MM）
                const time = new Date(item.created_at).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                // 前三名样式
                if (index === 0) li.innerHTML = `<span class="rank top1">🥇</span> ${item.player_name}：${item.score}分（${time}）`;
                else if (index === 1) li.innerHTML = `<span class="rank top2">🥈</span> ${item.player_name}：${item.score}分（${time}）`;
                else if (index === 2) li.innerHTML = `<span class="rank top3">🥉</span> ${item.player_name}：${item.score}分（${time}）`;
                else li.innerHTML = `<span class="rank">${index + 1}</span> ${item.player_name}：${item.score}分（${time}）`;
                olList.appendChild(li);
            });
            leaderboardElement.appendChild(olList);

        } catch (error) {
            leaderboardElement.innerHTML = '<li class="error-leaderboard">排行榜加载失败，请刷新页面重试！</li>';
            console.error('排行榜加载失败：', error.message);
        } finally {
            leaderboardLoading.style.display = 'none';
        }
    }


    // --- 6. 游戏绘制与逻辑：解决无食物问题 ---
    /**
     * 清空画布
     */
    function clearCanvas() {
        ctx.fillStyle = '#000'; // 黑色背景
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * 生成食物/道具：解决“无食物”问题（增加容错+兜底）
     */
    function randomFood() {
        foodGenerateCount++;
        let isOverlap = true;
        let loopCount = 0; // 循环计数器：避免蛇占满地图时死循环
        const maxLoop = 100; // 最大循环次数

        // 判定是否生成道具（每5次食物，20%概率）
        const isProp = foodGenerateCount % PROP_INTERVAL === 0 && Math.random() < PROP_RATE;
        if (isProp) {
            // 随机选择道具类型
            const propKeys = Object.keys(propTypes);
            const randomProp = propKeys[Math.floor(Math.random() * propKeys.length)];

            // 生成道具：最多尝试100次，超过则强制生成
            while (isOverlap && loopCount < maxLoop) {
                loopCount++;
                isOverlap = false;
                // 随机道具坐标
                prop = {
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount),
                    type: randomProp,
                    config: propTypes[randomProp]
                };
                // 检查是否与蛇身重叠
                snake.forEach(segment => {
                    if (segment.x === prop.x && segment.y === prop.y) isOverlap = true;
                });
                // 超过最大循环次数：强制生成（避免卡住）
                if (loopCount >= maxLoop) {
                    isOverlap = false;
                    console.log('道具生成重叠过多，强制生成');
                }
            }

            // 道具5秒后过期，过期后立即生成食物（兜底）
            if (propTimer) clearTimeout(propTimer);
            propTimer = setTimeout(() => {
                prop = null;
                showPropTip('道具已过期');
                randomFood(); // 过期后立即补食物
            }, 5000);
            foodGenerateCount = 0; // 重置食物计数

        } else {
            // 生成普通食物：同样增加容错
            while (isOverlap && loopCount < maxLoop) {
                loopCount++;
                isOverlap = false;
                // 随机食物坐标
                food = {
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount)
                };
                // 检查是否与蛇身/道具重叠
                snake.forEach(segment => {
                    if (segment.x === food.x && segment.y === food.y) isOverlap = true;
                });
                if (prop && food.x === prop.x && food.y === prop.y) isOverlap = true;
                // 超过最大循环次数：强制生成
                if (loopCount >= maxLoop) {
                    isOverlap = false;
                    console.log('食物生成重叠过多，强制生成');
                }
            }
        }

        // 最终兜底：确保食物/道具至少有一个存在
        if ((!food.x && !food.y) && !prop) {
            food = { x: 2, y: 2 }; // 强制生成默认食物
            console.log('兜底：强制生成食物');
        }
    }

    /**
     * 显示道具效果提示（3秒后自动隐藏）
     * @param {string} text - 提示内容
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
        if (!prop) return;
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
     * 绘制蛇：区分蛇头/蛇身，方便判断方向
     */
    function drawSnake() {
        snake.forEach((segment, index) => {
            // 蛇头：深绿色（区分蛇身）
            if (index === 0) ctx.fillStyle = '#00cc00';
            // 蛇身：亮绿色
            else ctx.fillStyle = '#39ff14';
            // 绘制蛇（留1px间距，避免贴边）
            ctx.fillRect(
                segment.x * gridSize + 1,
                segment.y * gridSize + 1,
                gridSize - 2,
                gridSize - 2
            );
        });
    }

    /**
     * 绘制普通食物（红色）
     */
    function drawFood() {
        ctx.fillStyle = '#ff6b6b'; // 亮红色
        ctx.fillRect(
            food.x * gridSize + 1,
            food.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );
    }

    /**
     * 移动蛇：处理蛇身跟随
     */
    function moveSnake() {
        // 计算新蛇头位置
        const head = { x: snake[0].x + dx, y: snake[0].y + dy };
        // 新蛇头加入蛇身头部
        snake.unshift(head);
        // 未吃到食物/道具时，删除蛇尾（实现移动）
        if (!(head.x === food.x && head.y === food.y) && !(prop && head.x === prop.x && head.y === prop.y)) {
            snake.pop();
        }
    }

    /**
     * 检查游戏是否结束（撞墙/撞自己）
     * @returns {boolean} - true=结束，false=继续
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
     * 检查碰撞：食物/道具
     */
    function checkFoodCollision() {
        const head = snake[0];
        // 1. 道具碰撞：触发效果
        if (prop && head.x === prop.x && head.y === prop.y) {
            prop.config.effect();
            prop = null; // 道具被吃后清空
            if (propTimer) clearTimeout(propTimer); // 清除过期定时器
            return;
        }
        // 2. 食物碰撞：加分+生成新食物（避免无食物）
        if (head.x === food.x && head.y === food.y) {
            score += 10 * scoreMultiplier; // 得分×倍数
            scoreElement.textContent = score;
            randomFood(); // 立即生成新食物
        }
    }

    /**
     * 游戏主绘制循环
     */
    function drawGame() {
        clearCanvas();

        // 未开始游戏：仅绘制静态画面（蛇+食物+道具）
        if (gameLoop === null) {
            drawFood();
            drawProp();
            drawSnake();
            return;
        }

        // 已开始游戏：执行完整逻辑
        moveSnake();

        // 无敌状态：撞墙/撞自己不结束，仅扣1节
        if (checkGameOver()) {
            if (isInvincible) {
                snake.pop(); // 扣1节身体
                showPropTip('无敌保护！扣除1节身体');
                return;
            } else {
                resetGame(); // 非无敌则结束游戏
                return;
            }
        }

        checkFoodCollision(); // 检查碰撞
        drawFood(); // 绘制食物
        drawProp(); // 绘制道具
        drawSnake(); // 绘制蛇
    }


    // --- 7. 输入控制：键盘+按钮+触摸 ---
    /**
     * 处理方向控制（防止反向移动）
     * @param {number} keyCode - 键盘码
     */
    function changeDirection(keyCode) {
        // 首次操作：启动游戏循环
        if (gameLoop === null) {
            gameLoop = setInterval(drawGame, 100); // 基础速度100ms/帧
            gameTipElement.style.opacity = '0'; // 隐藏开始提示
        }

        // 防止反向移动（如向上时不能直接向下）
        const goingUp = dy === -1;
        const goingDown = dy === 1;
        const goingLeft = dx === -1;
        const goingRight = dx === 1;

        switch (keyCode) {
            case 37: // 左箭头
                if (!goingRight) { dx = -1; dy = 0; }
                break;
            case 38: // 上箭头
                if (!goingDown) { dx = 0; dy = -1; }
                break;
            case 39: // 右箭头
                if (!goingLeft) { dx = 1; dy = 0; }
                break;
            case 40: // 下箭头
                if (!goingUp) { dx = 0; dy = 1; }
                break;
        }
    }

    // 键盘控制：方向键
    document.addEventListener('keydown', (e) => {
        // 仅响应方向键
        if ([37, 38, 39, 40].includes(e.keyCode)) {
            e.preventDefault(); // 阻止页面滚动
            changeDirection(e.keyCode);
        }
    });

    // 屏幕按钮控制：上下左右按钮
    document.getElementById('upButton').addEventListener('click', () => changeDirection(38));
    document.getElementById('downButton').addEventListener('click', () => changeDirection(40));
    document.getElementById('leftButton').addEventListener('click', () => changeDirection(37));
    document.getElementById('rightButton').addEventListener('click', () => changeDirection(39));

    // 移动端触摸控制：虚拟按钮
    const controlBtns = document.querySelectorAll('.control-btn');
    controlBtns.forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 防止触摸事件冒泡
            switch (btn.id) {
                case 'upButton': changeDirection(38); break;
                case 'downButton': changeDirection(40); break;
                case 'leftButton': changeDirection(37); break;
                case 'rightButton': changeDirection(39); break;
            }
        });
    });


    // --- 8. 响应式适配：窗口缩放时调整地图 ---
    window.addEventListener('resize', () => {
        initCanvasSize(); // 重新计算Canvas尺寸和格子数
        // 重新生成食物（避免食物超出新地图范围）
        if (food) randomFood();
        // 未开始游戏时重绘
        if (gameLoop === null) drawGame();
    });
};