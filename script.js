const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scorePanel = document.getElementById('score-panel');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const bestScoreDisplay = document.getElementById('best-score');
const flashEffect = document.getElementById('flash-effect');

// --- AUDIO CONTEXT ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playJumpSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playCrashSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function playScoreSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// --- GAME STATE ---
let W, H;
let gameState = 'START';
let score = 0;
let bestScore = 0;
let frameCount = 0;
let shakeTime = 0;
let lastTime = 0;

const PIXEL = 4;
const GRAVITY = 0.25;
const JUMP = -5.5;
const PIPE_SPEED = 3.5;
const PIPE_SPAWN_RATE = 120;
const GROUND_HEIGHT = 100;

// Base frame rate for normalization (60fps)
const TARGET_FPS = 60;
const MS_PER_FRAME = 1000 / TARGET_FPS;

let bird = { x: 100, y: 0, w: 42, h: 30, velocity: 0, rotation: 0 };
let pipes = [];
let particles = [];
let clouds = [];

// --- FUNCTIONS ---
function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    if (gameState === 'START') {
        clouds = [];
        for (let i = 0; i < Math.ceil(W / 250); i++) {
            clouds.push({
                x: Math.random() * W,
                y: Math.random() * (H * 0.4),
                s: 0.3 + Math.random() * 0.7,
                w: 80 + Math.random() * 40
            });
        }
    }
}

function init() {
    resize();
    bestScore = localStorage.getItem('pixelBirdBest') || 0;
    const startBest = document.getElementById('start-best');
    if (startBest) startBest.textContent = `BEST: ${bestScore}`;

    bird.y = H / 2;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes = [];
    particles = [];
    score = 0;
    frameCount = 0;
    shakeTime = 0;
    scorePanel.textContent = '0';
    gameState = 'START';
}

function jump() {
    initAudio();
    if (gameState === 'START') {
        gameState = 'PLAYING';
        startScreen.classList.add('hidden');
        playJumpSound();
    } else if (gameState === 'PLAYING') {
        bird.velocity = JUMP;
        createParticles(bird.x, bird.y + bird.h/2, '#fff', 5);
        playJumpSound();
    }
}

function spawnPipe() {
    const gap = 200;
    const minPipeH = 80;
    const maxPipeH = H - GROUND_HEIGHT - gap - minPipeH;
    const topHeight = Math.floor(Math.random() * (maxPipeH - minPipeH + 1) + minPipeH);
    pipes.push({ x: W, topHeight: topHeight, gap: gap, passed: false });
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y, 
            vx: (Math.random() - 0.5) * 8, 
            vy: (Math.random() - 0.5) * 8,
            life: 1, 
            color, 
            size: Math.random() * 8 + 2
        });
    }
}

function triggerFlash() {
    flashEffect.style.opacity = '1';
    setTimeout(() => {
        flashEffect.style.transition = 'opacity 0.6s ease-out';
        flashEffect.style.opacity = '0';
        setTimeout(() => { flashEffect.style.transition = 'none'; }, 600);
    }, 40);
}

function gameOver() {
    if (gameState === 'GAME_OVER_FALL' || gameState === 'DEAD') return;
    gameState = 'GAME_OVER_FALL';
    triggerFlash();
    playCrashSound();
    shakeTime = 20;
    createParticles(bird.x + bird.w / 2, bird.y + bird.h / 2, '#ff4d4d', 25);
    
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('pixelBirdBest', bestScore);
    }
    
    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
        finalScoreDisplay.textContent = `SCORE: ${score}`;
        bestScoreDisplay.textContent = `BEST: ${bestScore}`;
    }, 800);
}

function update(dt) {
    if (gameState !== 'PLAYING' && gameState !== 'GAME_OVER_FALL') return;
    
    frameCount += dt;
    bird.velocity += GRAVITY * dt;
    bird.y += bird.velocity * dt;
    
    // Smoother rotation based on velocity
    const targetRotation = Math.min(Math.PI / 2.5, Math.max(-Math.PI / 6, bird.velocity * 0.12));
    bird.rotation += (targetRotation - bird.rotation) * 0.3 * dt;

    if (gameState === 'PLAYING') {
        // Use a counter that increments by dt for spawning
        if (Math.floor(frameCount / PIPE_SPAWN_RATE) > Math.floor((frameCount - dt) / PIPE_SPAWN_RATE)) {
            spawnPipe();
        }
        
        for (let i = pipes.length - 1; i >= 0; i--) {
            const p = pipes[i];
            p.x -= PIPE_SPEED * dt;
            
            // Refined Hitbox
            const birdBox = { 
                left: bird.x + 10, 
                right: bird.x + bird.w - 10, 
                top: bird.y + 10, 
                bottom: bird.y + bird.h - 10 
            };
            
            if (birdBox.right > p.x && birdBox.left < p.x + 80) {
                if (birdBox.top < p.topHeight || birdBox.bottom > p.topHeight + p.gap) {
                    gameOver();
                }
            }
            
            if (!p.passed && p.x + 40 < bird.x) {
                p.passed = true;
                score++;
                scorePanel.textContent = score;
                playScoreSound();
                // Score pop animation
                scorePanel.style.animation = 'none';
                void scorePanel.offsetWidth; // trigger reflow
                scorePanel.style.animation = 'scorePop 0.2s ease-out';
                createParticles(bird.x + bird.w, bird.y + bird.h / 2, '#ffd700', 10);
            }
            
            if (p.x < -100) pipes.splice(i, 1);
        }
        
        clouds.forEach(c => {
            c.x -= 0.5 * c.s * dt;
            if (c.x < -150) {
                c.x = W + 50;
                c.y = Math.random() * (H * 0.4);
            }
        });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt; 
        p.y += p.vy * dt; 
        p.vy += 0.25 * dt; 
        p.life -= 0.025 * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    if (shakeTime > 0) shakeTime -= dt;

    if (bird.y + bird.h >= H - GROUND_HEIGHT) {
        bird.y = H - GROUND_HEIGHT - bird.h;
        if (gameState === 'PLAYING') gameOver();
        gameState = 'DEAD';
    }
    
    if (bird.y < 0) { 
        bird.y = 0; 
        bird.velocity = 0; 
    }
}

function drawPipe(p) {
    const pipeW = 80;
    const colorMain = '#73be2e', colorDark = '#538125', colorLight = '#9de64a', colorOutline = '#000';
    
    const renderHalf = (x, y, h, isTop) => {
        if (h <= 0) return;
        
        ctx.fillStyle = colorOutline; 
        ctx.fillRect(x, y, pipeW, h);
        
        ctx.fillStyle = colorMain; 
        ctx.fillRect(x + 4, y, pipeW - 8, h);
        
        ctx.fillStyle = colorLight; 
        ctx.fillRect(x + 4, y, 8, h);
        
        ctx.fillStyle = colorDark; 
        ctx.fillRect(x + pipeW - 16, y, 8, h);

        // Cap
        const capY = isTop ? y + h - 35 : y;
        ctx.fillStyle = colorOutline; 
        ctx.fillRect(x - 8, capY, pipeW + 16, 35);
        
        ctx.fillStyle = colorMain; 
        ctx.fillRect(x - 4, capY + 4, pipeW + 8, 27);
        
        ctx.fillStyle = colorLight; 
        ctx.fillRect(x - 4, capY + 4, 8, 27);
        
        ctx.fillStyle = colorDark; 
        ctx.fillRect(x + pipeW - 4, capY + 4, 8, 27);
    };
    
    renderHalf(p.x, 0, p.topHeight, true);
    renderHalf(p.x, p.topHeight + p.gap, H - GROUND_HEIGHT - (p.topHeight + p.gap), false);
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x + bird.w / 2, bird.y + bird.h / 2);
    ctx.rotate(bird.rotation);
    
    const bx = -bird.w / 2, by = -bird.h / 2;
    
    // Outline
    ctx.fillStyle = '#000'; 
    ctx.fillRect(bx, by, bird.w, bird.h);
    
    // Body
    ctx.fillStyle = '#f7d010'; 
    ctx.fillRect(bx + 2, by + 2, bird.w - 4, bird.h - 4);
    
    // Belly/Eye area
    ctx.fillStyle = '#fff'; 
    ctx.fillRect(bx + 2, by + 15, 20, 10);
    ctx.fillStyle = '#fff'; 
    ctx.fillRect(bx + 25, by + 5, 12, 12);
    
    // Eye
    ctx.fillStyle = '#000'; 
    ctx.fillRect(bx + 32, by + 8, 5, 5);
    
    // Beak
    ctx.fillStyle = '#f75d10'; 
    ctx.fillRect(bx + 30, by + 18, 15, 10);
    ctx.fillStyle = '#000'; 
    ctx.fillRect(bx + 30, by + 18, 15, 2);
    
    // Wing animation
    const wingOffset = Math.sin(frameCount * 0.4) * 5;
    ctx.fillStyle = '#fff'; 
    ctx.fillRect(bx + 5, by + 12 + (gameState === 'PLAYING' ? wingOffset : 0), 18, 12);
    ctx.strokeStyle = '#000'; 
    ctx.lineWidth = 2; 
    ctx.strokeRect(bx + 5, by + 12 + (gameState === 'PLAYING' ? wingOffset : 0), 18, 12);
    
    ctx.restore();
}

function drawBackground() {
    // Sky Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#4facfe');
    gradient.addColorStop(1, '#00f2fe');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Sun
    const sunX = W - 100, sunY = 80;
    ctx.fillStyle = '#f7d010'; 
    ctx.fillRect(sunX, sunY, 70, 70);
    ctx.fillStyle = '#ffae00'; 
    ctx.fillRect(sunX + 10, sunY + 10, 50, 50);

    // Clouds
    clouds.forEach(c => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(c.x, c.y, c.w, 40); 
        ctx.fillRect(c.x + 20, c.y - 20, c.w - 40, 20); 
        ctx.fillRect(c.x + 60, c.y + 10, 40, 20);
    });

    // Distant Bushes
    ctx.fillStyle = '#4eb648';
    const bushW = 160;
    for (let i = 0; i < Math.ceil(W / bushW) + 1; i++) {
        const x = (i * bushW) - (frameCount * 0.5 % bushW);
        ctx.fillRect(x, H - GROUND_HEIGHT - 40, 100, 40);
        ctx.fillRect(x + 25, H - GROUND_HEIGHT - 60, 50, 20);
    }
}

function drawFloor() {
    const floorY = H - GROUND_HEIGHT;
    
    // Grass top
    ctx.fillStyle = '#73be2e'; 
    ctx.fillRect(0, floorY, W, 25);
    
    // Stripes
    ctx.fillStyle = '#538125';
    const stripeW = 30;
    for (let i = 0; i < Math.ceil(W / stripeW) + 2; i++) {
        const moveX = (gameState === 'PLAYING' ? (frameCount * PIPE_SPEED) % stripeW : 0);
        const x = (i * stripeW) - moveX;
        ctx.fillRect(x, floorY, 15, 25);
    }
    
    // Dirt bottom
    ctx.fillStyle = '#ded895'; 
    ctx.fillRect(0, floorY + 25, W, GROUND_HEIGHT - 25);
    
    // Black line separator
    ctx.fillStyle = '#000'; 
    ctx.fillRect(0, floorY, W, 4);
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life; 
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;

    // Normalize dt to 60fps (dt = 1.0 at 60fps)
    const dt = elapsed / MS_PER_FRAME;

    // Cap dt to prevent massive jumps on tab focus/lag
    const cappedDt = Math.min(dt, 3);

    update(cappedDt);
    ctx.clearRect(0, 0, W, H);
    
    ctx.save();
    if (shakeTime > 0) {
        ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    }
    
    drawBackground();
    pipes.forEach(drawPipe);
    drawFloor();
    drawParticles();
    drawBird();
    
    ctx.restore();
    requestAnimationFrame(loop);
}

// --- LISTENERS ---
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space') {
        e.preventDefault();
        jump(); 
    }
});
canvas.addEventListener('mousedown', jump);
canvas.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    jump(); 
});

document.getElementById('start-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    jump();
});

document.getElementById('retry-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    init();
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// --- START ---
init();
requestAnimationFrame(loop);
