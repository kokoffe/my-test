window.onload = function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');

    // 游戏配置
    const gridSize = 20;
    const tileCount = canvas.width / gridSize;

    let snake = [
        {x: 10, y: 10}
    ];
    let food = {};
    let dx = 0;
    let dy = 0;
    let score = 0;

    // 按键常量
    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;

    // 随机生成食物
    function randomFood() {
        food = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
    }

    // 绘制游戏元素
    function drawGame() {
        // 清空画布
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 移动蛇头
        const head = {x: snake[0].x + dx, y: snake[0].y + dy};

        // 检查碰撞
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
            resetGame();
            return;
        }

        // 检查是否吃到自己
        for (let i = 0; i < snake.length; i++) {
            const segment = snake[i];
            if (head.x === segment.x && head.y === segment.y) {
                resetGame();
                return;
            }
        }

        snake.unshift(head); // 新蛇头

        // 检查是否吃到食物
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            scoreElement.textContent = score;
            randomFood();
        } else {
            snake.pop(); // 没吃到食物，移除蛇尾
        }

        // 画蛇
        ctx.fillStyle = 'lime';
        for (let segment of snake) {
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
        }

        // 画食物
        ctx.fillStyle = 'red';
        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
    }

    // 重置游戏
    function resetGame() {
        snake = [{x: 10, y: 10}];
        dx = 0;
        dy = 0;
        score = 0;
        scoreElement.textContent = score;
        randomFood();
    }

    // 方向改变逻辑
    function changeDirection(keyCode) {
        const goingUp = dy === -1;
        const goingDown = dy === 1;
        const goingRight = dx === 1;
        const goingLeft = dx === -1;

        if (keyCode === LEFT_KEY && !goingRight) {
            dx = -1;
            dy = 0;
        }
        if (keyCode === UP_KEY && !goingDown) {
            dx = 0;
            dy = -1;
        }
        if (keyCode === RIGHT_KEY && !goingLeft) {
            dx = 1;
            dy = 0;
        }
        if (keyCode === DOWN_KEY && !goingUp) {
            dx = 0;
            dy = 1;
        }
    }

    // 键盘控制监听
    document.addEventListener('keydown', (event) => {
        changeDirection(event.keyCode);
    });

    // 按钮控制监听
    document.getElementById('upButton').addEventListener('click', () => changeDirection(UP_KEY));
    document.getElementById('downButton').addEventListener('click', () => changeDirection(DOWN_KEY));
    document.getElementById('leftButton').addEventListener('click', () => changeDirection(LEFT_KEY));
    document.getElementById('rightButton').addEventListener('click', () => changeDirection(RIGHT_KEY));
    
    // 为移动端添加触摸事件
    const buttons = document.querySelectorAll('.controls button');
    buttons.forEach(button => {
        // 触摸开始时触发方向改变
        button.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 阻止默认的滚动行为
            const id = e.target.id;
            switch(id) {
                case 'upButton': changeDirection(UP_KEY); break;
                case 'downButton': changeDirection(DOWN_KEY); break;
                case 'leftButton': changeDirection(LEFT_KEY); break;
                case 'rightButton': changeDirection(RIGHT_KEY); break;
            }
        });
    });

    // 游戏主循环
    randomFood();
    setInterval(drawGame, 100);
};
