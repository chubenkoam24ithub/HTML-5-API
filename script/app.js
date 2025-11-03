// script/app.js
// === PWA Registration ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
    });
}

// === GitHub Pages SPA Redirect Support ===
const spaPath = sessionStorage.getItem('spa-path');
if (spaPath && location.pathname.includes('/index.html')) {
    sessionStorage.removeItem('spa-path');
    const path = spaPath || '/home';
    history.replaceState(null, '', path);
}

// === Theme Toggle ===
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    themeToggle.textContent = document.body.classList.contains('dark') ? '☀ Светлая' : '🌙 Темная';
});
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀ Светлая';
}

// === History API ===
const contentElement = document.getElementById("content");  // ИСПРАВЛЕНО: была обрезана!
const pageTitle = document.getElementById("page-title");
const canvasContainer = document.getElementById("canvas-container");
const workerSection = document.getElementById("worker-section");

const pages = {
    home: { title: "Home", content: "<p>Это домашняя страница. Здесь вы можете перейти по ссылкам.</p>", url: "/home" },
    about: { title: "About", content: "<p>О проекте: Демонстрация History API, Canvas, Web Workers и Storage API.</p>", url: "/about" },
    canvas: { title: "Canvas Анимация", content: "<p>Интерактивная анимация шариков с сохранением в LocalStorage.</p>", url: "/canvas" },
    worker: { title: "Web Worker", content: "<p>Фоновые вычисления без блокировки UI.</p>", url: "/worker" }
};

function showNotification(title) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification("Переход на страницу", { body: title, icon: "/icons/icon-192.png" });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(perm => { if (perm === "granted") showNotification(title); });
    }
}

let canvas, ctx, animationId, balls = [], fps = 0, lastTime = performance.now();
let worker, currentWorkerId = 0;
const STORAGE_KEY = 'canvasState';
let saveTimer;

function saveCanvasState() {
    const state = {
        balls: balls.map(b => ({x: b.x, y: b.y, radius: b.radius, color: b.color, vx: b.vx, vy: b.vy})),
        animationRunning: !!animationId
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Storage save error:", e);
    }
}

function loadCanvasState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);
            balls = state.balls.map(b => {
                const ball = new Ball(b.x, b.y);
                ball.radius = b.radius; ball.color = b.color; ball.vx = b.vx; ball.vy = b.vy;
                return ball;
            });
            redrawCanvas();
            if (state.animationRunning) startAnimation();
            return true;
        }
    } catch (e) {
        console.error("Storage load error:", e);
    }
    return false;
}

function loadPage(page) {
    pageTitle.textContent = page.title;
    contentElement.innerHTML = page.content;  // Теперь contentElement определён!
    document.title = page.title + " | Практика";

    canvasContainer.style.display = (page.url === "/canvas") ? "block" : "none";
    workerSection.style.display = (page.url === "/worker") ? "block" : "none";

    if (page.url === "/canvas") {
        initCanvas();
        if (!loadCanvasState() && page.balls) {
            balls = page.balls.map(b => {
                const ball = new Ball(b.x, b.y);
                ball.radius = b.radius; ball.color = b.color; ball.vx = b.vx; ball.vy = b.vy;
                return ball;
            });
            if (page.animationRunning) startAnimation();
        }
        redrawCanvas();
        clearInterval(saveTimer);
        saveTimer = setInterval(saveCanvasState, 5000);
    } else {
        clearInterval(saveTimer);
    }
    if (page.url === "/worker") initWorkerUI();

    showNotification(page.title);
}

function handleClick(event) {
    const url = event.target.getAttribute("href");
    const pageName = url.split("/").pop() || "home";
    let page = { ...pages[pageName] };

    if (history.state && history.state.url === "/canvas") {
        page.balls = balls.map(b => ({x: b.x, y: b.y, radius: b.radius, color: b.color, vx: b.vx, vy: b.vy}));
        page.animationRunning = !!animationId;
        saveCanvasState();
    }

    if (history.state && history.state.url !== url) {
        history.pushState(page, page.title, url);
        loadPage(page);
    }
    event.preventDefault();
}

window.addEventListener("popstate", (event) => {
    if (event.state) {
        loadPage(event.state);
    } else {
        const defaultPage = pages.home;
        history.replaceState(defaultPage, defaultPage.title, defaultPage.url);
        loadPage(defaultPage);
    }
});

document.getElementById("back").addEventListener("click", () => history.back());
document.getElementById("forward").addEventListener("click", () => history.forward());

document.querySelectorAll(".nav-links a").forEach(link => link.addEventListener("click", handleClick));

// Инициализация с поддержкой SPA path
let currentPath = location.pathname || '/home';
if (spaPath) currentPath = spaPath;
let initialPageName = currentPath.split('/').pop() || 'home';
let initialPage = pages[initialPageName] || pages.home;
if (!history.state) history.replaceState(initialPage, initialPage.title, initialPage.url);
loadPage(history.state || initialPage);

// === Canvas API ===
function initCanvas() {
    canvas = document.getElementById("myCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    if (!ctx) { alert("Canvas не поддерживается!"); return; }

    resizeCanvas();
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 200);
    });

    canvas.addEventListener("click", addBall);
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); addBall(e.touches[0]); }, { passive: false });

    document.getElementById("start-animation").addEventListener("click", startAnimation);
    document.getElementById("stop-animation").addEventListener("click", () => { stopAnimation(); saveCanvasState(); });
    document.getElementById("clear-balls").addEventListener("click", () => {
        balls = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        localStorage.removeItem(STORAGE_KEY);
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
        document.getElementById("fps").textContent = '0';
    });
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth - 40;
    canvas.height = Math.min(500, window.innerHeight * 0.6);
    redrawCanvas();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    balls.forEach(ball => ball.draw());
    document.getElementById("fps").textContent = fps;
}

class Ball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 20 + 10;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.vx = Math.random() * 4 - 2;
        this.vy = Math.random() * 4 - 2;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        this.vy += 0.05; // Гравитация
        this.x += this.vx;
        this.y += this.vy;

        // Отскок от стен
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx = -this.vx * 0.98; }
        if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.vx = -this.vx * 0.98; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.vy = -this.vy * 0.98; }
        if (this.y + this.radius > canvas.height) { this.y = canvas.height - this.radius; this.vy = -this.vy * 0.98; }
    }
}

function addBall(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX || event.pageX) - rect.left;
    const y = (event.clientY || event.pageY) - rect.top;
    const newBall = new Ball(x, y);
    balls.push(newBall);
    newBall.draw();
    saveCanvasState();
}

function animate() {
    const now = performance.now();
    fps = Math.round(1000 / (now - lastTime));
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    balls.forEach(ball => {
        ball.update();
        ball.draw();
    });

    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText(`FPS: ${fps}`, 10, 20);
    animationId = requestAnimationFrame(animate);
}

function startAnimation() {
    if (!animationId) {
        lastTime = performance.now();
        animate();
        saveCanvasState();
    }
}

function stopAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
        redrawCanvas();
        saveCanvasState();
    }
}

// === Web Workers ===
function initWorkerUI() {
    document.getElementById("status").textContent = "";
    document.getElementById("error").textContent = "";
    document.getElementById("result").textContent = "Результат: ";
    document.getElementById("worker-progress").style.display = 'none';
    document.getElementById("cancel-worker").style.display = 'none';

    document.getElementById("start-worker").addEventListener("click", startWorker);
}

function startWorker() {
    const input = document.getElementById("worker-input");
    const n = parseInt(input.value, 10);
    if (isNaN(n) || n < 1000000) {
        document.getElementById("error").textContent = "Ошибка: Введите число не менее 1 000 000";
        return;
    }

    document.getElementById("status").textContent = "Вычисления в процессе...";
    document.getElementById("error").textContent = "";
    document.getElementById("result").textContent = "Результат: ";
    const progress = document.getElementById("worker-progress");
    progress.style.display = 'block';
    progress.value = 0;
    document.getElementById("cancel-worker").style.display = 'block';

    if (worker) worker.terminate();
    const id = ++currentWorkerId;
    worker = new Worker('/script/worker.js');

    worker.postMessage({ command: 'start', n, id });

    worker.onmessage = (e) => {
        if (e.data.id !== id) return;
        if (e.data.type === 'progress') {
            progress.value = e.data.progress;
        } else if (e.data.type === 'result') {
            document.getElementById("result").textContent = `Результат: ${e.data.result}`;
            document.getElementById("status").textContent = "Вычисления завершены!";
            progress.style.display = 'none';
            document.getElementById("cancel-worker").style.display = 'none';
            worker.terminate();
        } else if (e.data.type === 'error') {
            document.getElementById("error").textContent = `Ошибка: ${e.data.message}`;
            document.getElementById("status").textContent = "";
            progress.style.display = 'none';
            document.getElementById("cancel-worker").style.display = 'none';
            worker.terminate();
        }
    };

    const handleError = (err) => {
        let msg = err.message || 'Неизвестная ошибка в Worker';
        document.getElementById("error").textContent = `Ошибка: ${msg}`;
        document.getElementById("status").textContent = "";
        progress.style.display = 'none';
        document.getElementById("cancel-worker").style.display = 'none';
        if (worker) worker.terminate();
    };

    worker.onerror = handleError;
    worker.addEventListener('error', handleError);

    document.getElementById("cancel-worker").onclick = () => {
        worker.postMessage({ command: 'cancel' });
        worker.terminate();
        document.getElementById("status").textContent = "Отменено";
        progress.style.display = 'none';
        document.getElementById("cancel-worker").style.display = 'none';
    };
}