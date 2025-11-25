const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---- 重要：连接到你的游戏服务器 ----
// 我们暂时先用本地地址测试
// const socket = new WebSocket('ws://localhost:8080');

// ---- 部署到网站后，需要改成这个 ----
const socket = new WebSocket('wss://117.176.220.123');


let isDrawing = false;

// 监听鼠标事件
canvas.addEventListener('mousedown', () => isDrawing = true);
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mousemove', draw);

function draw(event) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 把画线的数据发送给服务器
    socket.send(JSON.stringify({ type: 'draw', x, y }));
}

// ---- 监听来自服务器的消息 ----
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'draw') {
        ctx.beginPath();
        ctx.arc(data.x, data.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
};
