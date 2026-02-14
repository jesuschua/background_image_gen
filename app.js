class VisualScreensaver {
    constructor() {
        this.canvas = document.getElementById('visual-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.menu = document.getElementById('menu');
        this.visualContainer = document.getElementById('visual-container');
        this.currentVisual = null;
        this.animationId = null;
        this.wakeLock = null;
        this.previewCanvases = {};
        
        this.setupCanvas();
        this.setupEventListeners();
        this.initPreviews();
    }
    
    setupCanvas() {
        const resizeCanvas = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            if (this.currentVisual) {
                this.currentVisual.resize(this.canvas.width, this.canvas.height);
            }
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        // Fullscreen buttons
        document.querySelectorAll('.fullscreen-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const menuItem = e.target.closest('.menu-item');
                const visualType = menuItem.dataset.visual;
                this.startVisual(visualType);
            });
        });
        
        // Exit button
        document.getElementById('exit-fullscreen').addEventListener('click', () => {
            this.exitFullscreen();
        });
        
        // ESC key to exit
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.visualContainer.classList.contains('hidden')) {
                this.exitFullscreen();
            }
        });
        
        // Fullscreen API events
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                this.exitFullscreen();
            }
        });
    }
    
    async startVisual(type) {
        // Request fullscreen
        try {
            await this.visualContainer.requestFullscreen();
        } catch (e) {
            console.log('Fullscreen not available:', e);
        }
        
        // Request wake lock to prevent sleep
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (e) {
            console.log('Wake lock not available:', e);
        }
        
        // Hide menu, show visual
        this.menu.style.display = 'none';
        this.visualContainer.classList.remove('hidden');
        
        // Stop previous visual
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Create and start new visual
        const VisualClass = this.getVisualClass(type);
        this.currentVisual = new VisualClass(this.canvas, this.ctx);
        this.animate();
    }
    
    getVisualClass(type) {
        const visuals = {
            mosaic: MosaicVisual,
            smoke: SmokeVisual,
            lightshade: LightShadeVisual,
            lanterns: LanternsVisual,
            sunset: SunsetVisual,
            bloom: BloomVisual,
            urbanity: UrbanityVisual,
            streets: StreetsVisual
        };
        return visuals[type] || MosaicVisual;
    }
    
    animate() {
        this.currentVisual.update();
        this.currentVisual.render();
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    exitFullscreen() {
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Release wake lock
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
        
        // Exit fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        
        // Show menu, hide visual
        this.visualContainer.classList.add('hidden');
        this.menu.style.display = 'block';
        this.currentVisual = null;
    }
    
    initPreviews() {
        const types = ['mosaic', 'smoke', 'lightshade', 'lanterns', 'sunset', 'bloom', 'urbanity', 'streets'];
        const fullW = Math.min(window.innerWidth, 1920);
        const fullH = Math.min(window.innerHeight, 1080);
        document.documentElement.style.setProperty('--preview-aspect', `${fullW} / ${fullH}`);
        const previewW = 280;
        const previewH = Math.round(previewW * fullH / fullW);
        types.forEach(type => {
            const preview = document.getElementById(`preview-${type}`);
            const visibleCanvas = document.createElement('canvas');
            visibleCanvas.width = previewW;
            visibleCanvas.height = previewH;
            preview.appendChild(visibleCanvas);
            const visibleCtx = visibleCanvas.getContext('2d');
            
            const offscreen = document.createElement('canvas');
            offscreen.width = fullW;
            offscreen.height = fullH;
            const offscreenCtx = offscreen.getContext('2d');
            
            const VisualClass = this.getVisualClass(type);
            const visual = new VisualClass(offscreen, offscreenCtx);
            
            let lastTime = 0;
            const previewAnimate = (time) => {
                if (time - lastTime > 16) {
                    visual.update();
                    visual.render();
                    visibleCtx.drawImage(offscreen, 0, 0, fullW, fullH, 0, 0, previewW, previewH);
                    lastTime = time;
                }
                requestAnimationFrame(previewAnimate);
            };
            previewAnimate(0);
        });
    }
}

// Base Visual Class — scale so fullscreen matches preview density (ref = 280×200)
const REF_AREA = 280 * 200;
function visualScale(width, height) {
    return Math.sqrt((width * height) / REF_AREA);
}

class BaseVisual {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.width = canvas.width;
        this.height = canvas.height;
        this.time = 0;
        this.scale = visualScale(canvas.width, canvas.height);
    }
    
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.scale = visualScale(width, height);
    }
    
    update() {
        this.time += 0.016; // ~60fps
    }
    
    render() {
        // Override in subclasses
    }
}

// Mosaic Visual — low-poly triangulated mesh (no external deps), gradient colors, moving
class MosaicVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.grid = [];
        this.initMesh();
    }
    
    initMesh() {
        const s = this.scale;
        const cellSize = (36 + Math.random() * 24) * s;
        const jitter = 0.45;
        this.grid = [];
        const cols = Math.ceil(this.width / cellSize) + 2;
        const rows = Math.ceil(this.height / cellSize) + 2;
        
        for (let row = 0; row < rows; row++) {
            const r = [];
            for (let col = 0; col < cols; col++) {
                const jx = (Math.random() - 0.5) * cellSize * jitter;
                const jy = (Math.random() - 0.5) * cellSize * jitter;
                r.push({
                    x0: col * cellSize + jx - cellSize * 0.5,
                    y0: row * cellSize + jy - cellSize * 0.5,
                    x: 0,
                    y: 0,
                    phase: Math.random() * Math.PI * 2,
                    phaseY: Math.random() * Math.PI * 2,
                    amp: (4 + Math.random() * 10) * s
                });
            }
            this.grid.push(r);
        }
    }
    
    update() {
        super.update();
        const t = this.time * 0.2;
        const wobbleScale = 1;
        for (let row = 0; row < this.grid.length; row++) {
            for (let col = 0; col < this.grid[row].length; col++) {
                const p = this.grid[row][col];
                p.x = p.x0 + p.amp * Math.sin(t + p.phase) * wobbleScale;
                p.y = p.y0 + p.amp * Math.cos(t * 0.8 + p.phaseY) * wobbleScale;
            }
        }
    }
    
    render() {
        this.ctx.fillStyle = '#0a0a12';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        const hueOffset = (this.time * 14) % 360;
        
        for (let row = 0; row < this.grid.length - 1; row++) {
            for (let col = 0; col < this.grid[row].length - 1; col++) {
                const p00 = this.grid[row][col];
                const p10 = this.grid[row][col + 1];
                const p01 = this.grid[row + 1][col];
                const p11 = this.grid[row + 1][col + 1];
                
                const flip = (row + col) % 2 === 0;
                const tri1 = flip ? [p00, p10, p11] : [p00, p10, p01];
                const tri2 = flip ? [p00, p11, p01] : [p10, p11, p01];
                
                this.drawTriangle(tri1, hueOffset, row * (this.grid[row].length - 1) + col);
                this.drawTriangle(tri2, hueOffset, row * (this.grid[row].length - 1) + col + 1);
            }
        }
    }
    
    drawTriangle(pts, hueOffset, seed) {
        const [a, b, c] = pts;
        const cx = (a.x + b.x + c.x) / 3;
        const cy = (a.y + b.y + c.y) / 3;
        
        const nx = Math.max(0, Math.min(1, cx / this.width));
        const ny = Math.max(0, Math.min(1, cy / this.height));
        const hue = (hueOffset + (nx * 0.35 + ny * 0.65) * 300 + seed * 2) % 360;
        const sat = 70 + (seed % 3) * 10;
        const light = 40 + (Math.sin(this.time * 0.5 + seed * 0.2) * 0.5 + 0.5) * 25;
        
        this.ctx.beginPath();
        this.ctx.moveTo(a.x, a.y);
        this.ctx.lineTo(b.x, b.y);
        this.ctx.lineTo(c.x, c.y);
        this.ctx.closePath();
        this.ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        this.ctx.fill();
        this.ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light * 0.75}%, 0.4)`;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.initMesh();
    }
}

// Smoke Visual
class SmokeVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.particles = [];
        this.initParticles();
    }
    
    initParticles() {
        const s = this.scale;
        const count = Math.min(80, Math.max(50, Math.floor(50 * s)));
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: this.height + Math.random() * 200 * s,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -0.5 - Math.random() * 1.5,
                size: (20 + Math.random() * 80) * s,
                opacity: 0.1 + Math.random() * 0.3,
                life: Math.random()
            });
        }
    }
    
    update() {
        super.update();
        const s = this.scale;
        this.particles.forEach(p => {
            p.x += p.vx + Math.sin(this.time + p.life) * 0.3;
            p.y += p.vy;
            p.opacity *= 0.998;
            p.size *= 1.001;
            
            if (p.y < -p.size || p.opacity < 0.01) {
                p.x = Math.random() * this.width;
                p.y = this.height + Math.random() * 100 * s;
                p.opacity = 0.2 + Math.random() * 0.3;
                p.size = (20 + Math.random() * 80) * s;
            }
        });
    }
    
    render() {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.particles.forEach(p => {
            const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            gradient.addColorStop(0, `rgba(200, 200, 220, ${p.opacity})`);
            gradient.addColorStop(0.5, `rgba(150, 150, 180, ${p.opacity * 0.5})`);
            gradient.addColorStop(1, `rgba(100, 100, 140, 0)`);
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.initParticles();
    }
}

// Light and Shade Visual
class LightShadeVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.lights = [];
        this.initLights();
    }
    
    initLights() {
        const s = this.scale;
        const count = Math.min(12, Math.max(5, Math.floor(5 * s)));
        for (let i = 0; i < count; i++) {
            this.lights.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: (100 + Math.random() * 200) * s,
                speedX: (Math.random() - 0.5) * 2,
                speedY: (Math.random() - 0.5) * 2,
                hue: Math.random() * 360
            });
        }
    }
    
    update() {
        super.update();
        this.lights.forEach(light => {
            light.x += light.speedX;
            light.y += light.speedY;
            light.hue = (light.hue + 0.5) % 360;
            
            if (light.x < 0 || light.x > this.width) light.speedX *= -1;
            if (light.y < 0 || light.y > this.height) light.speedY *= -1;
        });
    }
    
    render() {
        // Dark base
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw lights with shadows
        this.lights.forEach(light => {
            const gradient = this.ctx.createRadialGradient(
                light.x, light.y, 0,
                light.x, light.y, light.radius
            );
            gradient.addColorStop(0, `hsla(${light.hue}, 70%, 60%, 0.8)`);
            gradient.addColorStop(0.5, `hsla(${light.hue}, 60%, 50%, 0.3)`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.initLights();
    }
}

// Lanterns Visual — Chinese lanterns; depth-sorted with branches and beams so they pass in/out
class LanternsVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.lanterns = [];
        this.obstructions = [];
        this.initLanterns();
        this.initObstructions();
    }
    
    initLanterns() {
        const s = this.scale;
        const count = Math.min(14, Math.max(5, Math.floor(6 * s)));
        const sizeScale = 0.58;
        for (let i = 0; i < count; i++) {
            this.lanterns.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: (28 + Math.random() * 38) * s * sizeScale,
                swing: Math.random() * Math.PI * 2,
                swingSpeed: 0.00015 + Math.random() * 0.00035,
                floatSpeed: (0.004 + Math.random() * 0.009) * s,
                swayAmount: 0.04 + Math.random() * 0.08,
                hue: 0 + Math.random() * 14,
                sat: 88 + Math.random() * 12,
                ribOffset: Math.random() * Math.PI
            });
        }
    }
    
    initObstructions() {
        const w = this.width;
        const h = this.height;
        const s = this.scale;
        this.obstructions = [];
        const branchColor = 'rgba(28, 22, 18, 0.92)';
        
        // Branches — curved strokes at various depths (lanterns will pass in front/behind)
        const branches = [
            { depth: 0.22, path: () => { this.ctx.moveTo(-w * 0.08, h * 0.2); this.ctx.quadraticCurveTo(w * 0.15, h * 0.1, w * 0.35, h * 0.5); this.ctx.quadraticCurveTo(w * 0.28, h * 0.75, w * 0.1, h * 1.05); } },
            { depth: 0.48, path: () => { this.ctx.moveTo(w * 1.02, h * 0.35); this.ctx.quadraticCurveTo(w * 0.82, h * 0.5, w * 0.7, h * 0.85); this.ctx.quadraticCurveTo(w * 0.65, h * 0.5, w * 0.5, h * 0.1); } },
            { depth: 0.58, path: () => { this.ctx.moveTo(-w * 0.05, h * 0.65); this.ctx.quadraticCurveTo(w * 0.4, h * 0.5, w * 0.72, h * 0.35); this.ctx.quadraticCurveTo(w * 0.6, h * 0.15, w * 0.25, -h * 0.05); } },
            { depth: 0.72, path: () => { this.ctx.moveTo(w * 0.88, h * 0.7); this.ctx.quadraticCurveTo(w * 0.5, h * 0.55, w * 0.12, h * 0.72); this.ctx.lineTo(-w * 0.03, h * 0.5); } },
            { depth: 0.35, path: () => { this.ctx.moveTo(w * 0.6, -h * 0.02); this.ctx.quadraticCurveTo(w * 0.75, h * 0.4, w * 0.68, h * 0.88); } },
        ];
        branches.forEach(b => this.obstructions.push({ type: 'branch', depth: b.depth, draw: b.path, color: branchColor, width: 4 + Math.random() * 5 }));
    }
    
    update() {
        super.update();
        const s = this.scale;
        this.lanterns.forEach(lantern => {
            lantern.swing += lantern.swingSpeed;
            lantern.x += Math.sin(lantern.swing) * lantern.swayAmount * s;
            lantern.y -= lantern.floatSpeed;
            if (lantern.y < -lantern.radius * 3) {
                lantern.y = this.height + lantern.radius * 2;
                lantern.x = Math.random() * this.width;
            }
        });
    }
    
    lanternDepth(lantern) {
        const y = Math.max(-lantern.radius * 2, Math.min(this.height + lantern.radius * 2, lantern.y));
        return 0.12 + 0.82 * (1 - (y / (this.height + lantern.radius * 4)));
    }
    
    drawObstruction(ob) {
        if (ob.type === 'branch') {
            this.ctx.strokeStyle = ob.color;
            this.ctx.lineWidth = (ob.width || 5) * this.scale;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            ob.draw.call(this);
            this.ctx.stroke();
        }
    }
    
    drawLanternLightSpill(lantern) {
        const r = lantern.radius;
        const h = lantern.hue;
        const sat = lantern.sat;
        const spillRadius = r * 3.2;
        const spill = this.ctx.createRadialGradient(
            lantern.x, lantern.y, 0,
            lantern.x, lantern.y, spillRadius
        );
        spill.addColorStop(0, `hsla(${h}, ${sat}%, 65%, 0.14)`);
        spill.addColorStop(0.4, `hsla(${h}, ${sat}%, 55%, 0.06)`);
        spill.addColorStop(0.7, `hsla(${h}, ${sat}%, 45%, 0.02)`);
        spill.addColorStop(1, 'transparent');
        this.ctx.fillStyle = spill;
        this.ctx.beginPath();
        this.ctx.arc(lantern.x, lantern.y, spillRadius, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawOneLantern(lantern) {
        const tilt = Math.sin(lantern.swing) * 0.05;
        const r = lantern.radius;
        const h = lantern.hue;
        const sat = lantern.sat;
        const hotY = -r * 0.15;
        
        this.ctx.save();
        this.ctx.translate(lantern.x, lantern.y);
        this.ctx.rotate(tilt);
        
        const halo = this.ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.8);
        halo.addColorStop(0, `hsla(${h}, ${sat}%, 55%, 0.12)`);
        halo.addColorStop(0.6, `hsla(${h}, ${sat}%, 45%, 0.04)`);
        halo.addColorStop(1, 'transparent');
        this.ctx.fillStyle = halo;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
        this.ctx.fill();
        
        const body = this.ctx.createRadialGradient(0, hotY, 0, 0, 0, r);
        body.addColorStop(0, 'hsla(35, 60%, 92%, 0.98)');
        body.addColorStop(0.08, 'hsla(12, 90%, 78%, 0.97)');
        body.addColorStop(0.2, `hsla(${h}, ${sat}%, 58%, 0.98)`);
        body.addColorStop(0.5, `hsla(${h}, ${sat}%, 52%, 0.97)`);
        body.addColorStop(0.85, `hsla(${h}, ${sat}%, 48%, 0.96)`);
        body.addColorStop(1, `hsla(${h}, ${sat}%, 38%, 0.92)`);
        this.ctx.fillStyle = body;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.fill();
        
        const ribCount = 10;
        this.ctx.strokeStyle = `hsla(${h}, ${sat}%, 28%, 0.22)`;
        this.ctx.lineWidth = Math.max(0.5, r * 0.012);
        for (let i = 0; i < ribCount; i++) {
            const a = (i / ribCount) * Math.PI * 2 + lantern.ribOffset;
            this.ctx.beginPath();
            for (let t = -0.88; t <= 0.88; t += 0.05) {
                const y = t * r;
                const x = Math.sqrt(Math.max(0, 1 - (y / r) * (y / r))) * r * Math.cos(a);
                if (t === -0.88) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.stroke();
        }
        
        this.ctx.fillStyle = 'hsla(0, 20%, 12%, 0.95)';
        this.ctx.beginPath();
        this.ctx.ellipse(0, -r - r * 0.04, r * 0.46, r * 0.1, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = 'hsla(0, 18%, 16%, 0.9)';
        this.ctx.lineWidth = Math.max(0.7, r * 0.03);
        this.ctx.beginPath();
        this.ctx.ellipse(0, r, r * 0.88, r * 0.05, 0, 0, Math.PI * 2);
        this.ctx.stroke();
        
        const tasselY = r + r * 0.1;
        this.ctx.strokeStyle = 'hsla(42, 68%, 50%, 0.88)';
        this.ctx.lineWidth = Math.max(0.7, r * 0.03);
        this.ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const angle = (i - 1) * 0.2 + tilt * 0.3;
            const len = r * (0.4 + (i % 2) * 0.15);
            this.ctx.beginPath();
            this.ctx.moveTo(0, tasselY);
            this.ctx.lineTo(Math.sin(angle) * len, tasselY + len);
            this.ctx.stroke();
        }
        this.ctx.lineCap = 'butt';
        this.ctx.restore();
    }
    
    render() {
        this.ctx.fillStyle = '#080810';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        const drawables = [];
        this.obstructions.forEach(ob => drawables.push({ depth: ob.depth, ob }));
        this.lanterns.forEach(lantern => drawables.push({ depth: this.lanternDepth(lantern), lantern }));
        drawables.sort((a, b) => a.depth - b.depth);
        
        drawables.forEach(d => {
            if (d.ob) this.drawObstruction(d.ob);
            else {
                this.drawLanternLightSpill(d.lantern);
                this.drawOneLantern(d.lantern);
            }
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.lanterns = [];
        this.obstructions = [];
        this.initLanterns();
        this.initObstructions();
    }
}

// Sunset Visual — zoomed-out view (smaller sun/clouds)
class SunsetVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.zoomOut = 0.58;
    }
    
    render() {
        const s = this.scale * this.zoomOut;
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        const sunY = this.height * 0.3 + Math.sin(this.time * 0.1) * 50 * s;
        const sunX = this.width * 0.5;
        const sunGlowR = 150 * s;
        const sunDiskR = 80 * s;
        
        skyGradient.addColorStop(0, '#1a1a2e');
        skyGradient.addColorStop(0.3, '#16213e');
        skyGradient.addColorStop(0.5, '#e94560');
        skyGradient.addColorStop(0.7, '#ff6b6b');
        skyGradient.addColorStop(1, '#ffa500');
        
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        const sunGradient = this.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunGlowR);
        sunGradient.addColorStop(0, '#fff8dc');
        sunGradient.addColorStop(0.5, '#ffd700');
        sunGradient.addColorStop(0.85, 'rgba(255, 220, 180, 0.25)');
        sunGradient.addColorStop(1, 'rgba(255, 235, 210, 0)');
        
        this.ctx.fillStyle = sunGradient;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunGlowR, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunDiskR, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.drawClouds(s);
    }
    
    drawClouds(s) {
        const seed = 12345;
        const hash = (n) => ((n * 92837111) ^ (n >>> 15)) >>> 0;
        const clouds = 5;
        for (let i = 0; i < clouds; i++) {
            const t = this.time * 0.08 * s;
            const baseX = (t * 120 + (hash(i + seed + 1) % 1000)) % (this.width + 400) - 200;
            const baseY = this.height * (0.35 + (hash(i + seed + 2) % 40) / 400) + Math.sin(this.time * 0.05 + i) * 8 * s;
            const blobCount = 4 + (hash(i + seed + 3) % 3);
            const opacity = 0.2 + (hash(i + seed + 4) % 18) / 100;
            this.ctx.save();
            for (let b = 0; b < blobCount; b++) {
                const bx = baseX + ((hash(i * 7 + b + seed) % 200) - 100) * 0.5 * s;
                const by = baseY + ((hash(i * 7 + b + seed + 1) % 80) - 40) * 0.7 * s;
                const br = (22 + (hash(i * 7 + b + seed + 2) % 32)) * s;
                const g = this.ctx.createRadialGradient(bx, by, 0, bx, by, br);
                g.addColorStop(0, `rgba(255, 248, 242, ${opacity * 0.9})`);
                g.addColorStop(0.45, `rgba(255, 238, 225, ${opacity * 0.5})`);
                g.addColorStop(0.8, `rgba(255, 230, 215, ${opacity * 0.2})`);
                g.addColorStop(1, 'rgba(255, 235, 220, 0)');
                this.ctx.fillStyle = g;
                this.ctx.beginPath();
                this.ctx.arc(bx, by, br, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }
    }
}

// Bloom Visual — reference style: layered petals, soft diffusion, sharp white outlines, mandala-like detail
class BloomVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.blooms = [];
        this.initBlooms();
    }
    
    initBlooms() {
        const s = this.scale;
        const w = this.width;
        const h = this.height;
        const count = 3;
        const minSide = Math.min(w, h);
        const baseSize = minSide * 0.3 * s;
        const sizeScales = [0.72, 1.15, 0.88];
        for (let i = 0; i < count; i++) {
            const tx = count > 1 ? i / (count - 1) : 0.5;
            const x = w * (0.18 + tx * 0.64);
            const y = h * 0.5 + (Math.random() - 0.5) * h * 0.08;
            const nx = x / w;
            let hue;
            if (nx < 0.38) hue = 200 + (nx / 0.38) * 20 + (Math.random() - 0.5) * 8;
            else if (nx < 0.62) hue = 130 + ((nx - 0.38) / 0.24) * 30 + (Math.random() - 0.5) * 10;
            else hue = 28 + ((nx - 0.62) / 0.38) * 22 + (Math.random() - 0.5) * 8;
            const r0 = Math.random() * Math.PI * 2;
            this.blooms.push({
                x, y,
                hue: (hue + 360) % 360,
                sat: 90 + Math.random() * 10,
                size: baseSize * (sizeScales[i] + (Math.random() - 0.5) * 0.12),
                rotation: r0,
                rotationLag: r0,
                rotationSpeed: 0.001 + (Math.random() - 0.5) * 0.0006,
                swayPhase: Math.random() * Math.PI * 2,
                swayTilt: 0,
                petalPhase: [],
                translucent: Math.random() < 0.5
            });
        }
        this.blooms.forEach(b => {
            const totalPetals = 6 + 10;
            for (let i = 0; i < totalPetals; i++) b.petalPhase.push(Math.random() * Math.PI * 2);
        });
    }
    
    update() {
        super.update();
        const t = this.time;
        const lagFactor = 0.014;
        this.blooms.forEach(b => {
            b.rotation += b.rotationSpeed;
            let d = b.rotation - b.rotationLag;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            b.rotationLag += d * lagFactor;
            b.swayTilt = 0.06 * Math.sin(t * 0.35 + b.swayPhase) + 0.03 * Math.sin(t * 0.5 + b.swayPhase * 0.7);
            b.petalPhase.forEach((_, i) => { b.petalPhase[i] += 0.006 + (i % 3) * 0.003; });
        });
    }
    
    drawPetalLayer(ctx, size, hue, n, inner, t, bloom, strokeW) {
        const isInner = inner;
        const sat = bloom.sat != null ? bloom.sat : 78;
        const len = size * (isInner ? 0.32 : 0.52);
        const halfW = size * (isInner ? 0.12 : 0.22);
        const alpha = bloom.translucent ? (isInner ? 0.5 : 0.45) : (isInner ? 0.78 : 0.72);
        const phaseOffset = isInner ? 0 : 6;
        
        for (let i = 0; i < n; i++) {
            const baseAngle = (Math.PI * 2 / n) * i + (isInner ? Math.PI / n : 0);
            const flutter = 0.042 * Math.sin(t + bloom.petalPhase[phaseOffset + i]);
            const angle = baseAngle + flutter;
            const lenScale = 0.95 + (i % 2) * 0.08;
            const wScale = 0.92 + (i % 3) * 0.06;
            const pl = len * lenScale;
            const pw = halfW * wScale;
            
            const tipX = Math.cos(angle) * pl;
            const tipY = Math.sin(angle) * pl;
            const cpx = Math.cos(angle) * pl * 0.45 + Math.cos(angle + Math.PI / 2) * pw;
            const cpy = Math.sin(angle) * pl * 0.45 + Math.sin(angle + Math.PI / 2) * pw;
            const cpx2 = Math.cos(angle) * pl * 0.45 - Math.cos(angle + Math.PI / 2) * pw;
            const cpy2 = Math.sin(angle) * pl * 0.45 - Math.sin(angle + Math.PI / 2) * pw;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(cpx, cpy, tipX, tipY);
            ctx.quadraticCurveTo(cpx2, cpy2, 0, 0);
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, 0, tipX, tipY);
            grad.addColorStop(0, `hsla(${hue}, ${sat}%, 58%, ${alpha})`);
            grad.addColorStop(0.35, `hsla(${hue}, ${sat}%, 65%, ${alpha * 0.92})`);
            grad.addColorStop(0.7, `hsla(${hue}, ${sat}%, 72%, ${alpha * 0.7})`);
            grad.addColorStop(1, `hsla(${hue}, ${Math.min(95, sat + 8)}%, 82%, ${alpha * 0.28})`);
            ctx.fillStyle = grad;
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
            ctx.lineWidth = strokeW;
            ctx.stroke();
            
            const midX = Math.cos(angle) * pl * 0.5;
            const midY = Math.sin(angle) * pl * 0.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = Math.max(0.5, size * 0.004);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(midX, midY);
            ctx.stroke();
        }
    }
    
    render() {
        const w = this.width;
        const h = this.height;
        const t = this.time;
        
        const bg = this.ctx.createLinearGradient(0, 0, w, 0);
        bg.addColorStop(0, '#f8f6f2');
        bg.addColorStop(0.3, '#faf8f5');
        bg.addColorStop(0.5, '#fbf9f6');
        bg.addColorStop(0.7, '#faf7f3');
        bg.addColorStop(1, '#f9f5ef');
        this.ctx.fillStyle = bg;
        this.ctx.fillRect(0, 0, w, h);
        
        for (let i = 0; i < 18; i++) {
            const gx = (i * 137) % w;
            const gy = (i * 89) % h;
            const spot = this.ctx.createRadialGradient(gx, gy, 0, gx, gy, 100);
            spot.addColorStop(0, 'rgba(255, 252, 248, 0.12)');
            spot.addColorStop(1, 'transparent');
            this.ctx.fillStyle = spot;
            this.ctx.fillRect(gx - 100, gy - 100, 200, 200);
        }
        
        this.blooms.forEach(bloom => {
            const size = bloom.size;
            const hue = bloom.hue;
            const sat = bloom.sat != null ? bloom.sat : 78;
            const strokeW = Math.max(1, size * 0.014);
            
            this.ctx.save();
            this.ctx.translate(bloom.x, bloom.y);
            this.ctx.rotate(bloom.rotation);
            this.ctx.rotate(bloom.swayTilt);
            
            const glow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.4);
            glow.addColorStop(0, `hsla(${hue}, ${sat}%, 75%, 0.18)`);
            glow.addColorStop(0.6, `hsla(${hue}, ${sat}%, 70%, 0.06)`);
            glow.addColorStop(1, 'transparent');
            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size * 1.35, 0, Math.PI * 2);
            this.ctx.fill();
            
            let petalLag = bloom.rotationLag - bloom.rotation;
            while (petalLag > Math.PI) petalLag -= Math.PI * 2;
            while (petalLag < -Math.PI) petalLag += Math.PI * 2;
            this.ctx.rotate(petalLag);
            this.drawPetalLayer(this.ctx, size, hue, 6, true, t, bloom, strokeW * 0.85);
            this.drawPetalLayer(this.ctx, size, hue, 10, false, t, bloom, strokeW);
            this.ctx.rotate(-petalLag);
            
            const centerR = size * 0.16;
            const centerGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, centerR);
            centerGrad.addColorStop(0, `hsl(${hue}, ${sat}%, 36%)`);
            centerGrad.addColorStop(0.7, `hsl(${hue}, ${sat}%, 26%)`);
            centerGrad.addColorStop(1, `hsl(${hue}, ${sat}%, 18%)`);
            this.ctx.fillStyle = centerGrad;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, centerR, 0, Math.PI * 2);
            this.ctx.fill();
            
            const rayCount = 28;
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.lineWidth = Math.max(0.6, size * 0.005);
            for (let i = 0; i < rayCount; i++) {
                const a = (i / rayCount) * Math.PI * 2;
                this.ctx.beginPath();
                this.ctx.moveTo(Math.cos(a) * centerR * 0.25, Math.sin(a) * centerR * 0.25);
                this.ctx.lineTo(Math.cos(a) * centerR, Math.sin(a) * centerR);
                this.ctx.stroke();
            }
            
            this.ctx.restore();
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.blooms = [];
        this.initBlooms();
    }
}

// Streets Visual — warm line-art street: sidewalks, establishments (shop fronts, awnings), road, gate, cars
class StreetsVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.cars = [];
        this.initCars();
    }
    
    initCars() {
        for (let i = 0; i < 5; i++) {
            this.cars.push({
                depth: 0.15 + (i / 5) * 0.7,
                phase: (i / 5) * 2,
                rightward: i % 2 === 0
            });
        }
    }
    
    update() {
        super.update();
        const speed = 0.00045;
        this.cars.forEach(c => {
            c.phase += c.rightward ? speed : -speed;
            if (c.phase > 2) c.phase -= 2;
            if (c.phase < 0) c.phase += 2;
        });
    }
    
    render() {
        const w = this.width;
        const h = this.height;
        const vpX = w * 0.5;
        const vpY = h * 0.32;
        const horizon = vpY + 30;
        
        const yToT = (y) => Math.min(1, Math.max(0, (y - vpY) / (h - vpY)));
        const project = (xNorm, y) => vpX + (xNorm * w - vpX) * yToT(y);
        
        const roadLeft = 0.22;
        const roadRight = 0.78;
        const sidewalkLeft = 0.08;
        const sidewalkRight = 0.92;
        const roadY1 = h;
        
        this.ctx.fillStyle = '#f8f6f2';
        this.ctx.fillRect(0, 0, w, h);
        
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 1.4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.fillStyle = 'rgba(232, 228, 220, 0.6)';
        this.ctx.beginPath();
        this.ctx.moveTo(project(0, roadY1), roadY1);
        this.ctx.lineTo(project(0, 0), 0);
        this.ctx.lineTo(project(sidewalkLeft, 0), 0);
        this.ctx.lineTo(project(roadLeft, horizon), horizon);
        this.ctx.lineTo(project(roadLeft, roadY1), roadY1);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(project(roadRight, roadY1), roadY1);
        this.ctx.lineTo(project(roadRight, horizon), horizon);
        this.ctx.lineTo(project(sidewalkRight, 0), 0);
        this.ctx.lineTo(w, 0);
        this.ctx.lineTo(project(1, roadY1), roadY1);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(project(roadLeft, roadY1), roadY1);
        this.ctx.lineTo(project(roadLeft, horizon), horizon);
        this.ctx.lineTo(vpX, vpY);
        this.ctx.lineTo(project(roadRight, horizon), horizon);
        this.ctx.lineTo(project(roadRight, roadY1), roadY1);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(228, 222, 212, 0.5)';
        this.ctx.fill();
        this.ctx.stroke();
        
        for (let y = roadY1 - 30; y > horizon; y -= 40) {
            const t = yToT(y);
            const segW = 16 * (1 - t * 0.75);
            const cx = project(0.5, y);
            this.ctx.strokeStyle = '#8a8478';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(cx - segW / 2, y - 3, segW, 6);
            this.ctx.strokeStyle = '#1a1a1a';
            this.ctx.lineWidth = 1.4;
        }
        
        const drawEstablishment = (xStart, widthNorm, topNorm, floors, hasAwning, hasDoor) => {
            const x0 = xStart;
            const x1 = xStart + widthNorm;
            const y0 = 0;
            const y1 = h * (1 - topNorm);
            const groundY = y1 + (y0 - y1) * 0.22;
            this.ctx.fillStyle = 'rgba(240, 236, 228, 0.7)';
            this.ctx.beginPath();
            this.ctx.moveTo(project(x0, y1), y1);
            this.ctx.lineTo(project(x0, y0), y0);
            this.ctx.lineTo(project(x1, y0), y0);
            this.ctx.lineTo(project(x1, y1), y1);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            if (hasAwning) {
                this.ctx.beginPath();
                this.ctx.moveTo(project(x0, groundY), groundY);
                this.ctx.lineTo(project(x0, groundY - 18), groundY - 18);
                this.ctx.lineTo(project(x1, groundY - 18), groundY - 18);
                this.ctx.lineTo(project(x1, groundY), groundY);
                this.ctx.closePath();
                this.ctx.stroke();
            }
            if (hasDoor) {
                const dx = (x0 + x1) / 2;
                this.ctx.beginPath();
                this.ctx.moveTo(project(dx - 0.008, groundY), groundY);
                this.ctx.lineTo(project(dx - 0.008, y1), y1);
                this.ctx.lineTo(project(dx + 0.008, y1), y1);
                this.ctx.lineTo(project(dx + 0.008, groundY), groundY);
                this.ctx.closePath();
                this.ctx.stroke();
            }
            for (let f = 1; f < floors; f++) {
                const fy = y1 + (y0 - y1) * (f / floors);
                this.ctx.beginPath();
                this.ctx.moveTo(project(x0, fy), fy);
                this.ctx.lineTo(project(x1, fy), fy);
                this.ctx.stroke();
            }
            const cols = 3;
            for (let c = 1; c < cols; c++) {
                const xNorm = x0 + (x1 - x0) * (c / cols);
                this.ctx.beginPath();
                this.ctx.moveTo(project(xNorm, y0), y0);
                this.ctx.lineTo(project(xNorm, y1), y1);
                this.ctx.stroke();
            }
            for (let f = 1; f < floors; f++) {
                for (let c = 0; c < cols; c++) {
                    const fx = x0 + (x1 - x0) * (c + 0.5) / cols;
                    const fy = y1 + (y0 - y1) * (f + 0.5) / floors;
                    const wx = (project(fx + 0.012, fy) - project(fx - 0.012, fy)) * 0.9;
                    const wy = 8;
                    this.ctx.strokeRect(project(fx, fy) - wx / 2, fy - wy / 2, Math.abs(wx), wy);
                }
            }
        };
        drawEstablishment(0, 0.07, 0.68, 5, true, true);
        drawEstablishment(0.07, 0.08, 0.52, 6, true, false);
        drawEstablishment(0.15, 0.05, 0.72, 4, false, true);
        drawEstablishment(0.88, 0.06, 0.62, 5, true, true);
        drawEstablishment(0.94, 0.06, 0.48, 6, true, false);
        
        const gateY = h * 0.48;
        const gateH = h * 0.2;
        const gateW = w * 0.45;
        const gx = vpX - gateW / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(gx, gateY + gateH);
        this.ctx.lineTo(gx + gateW * 0.1, gateY + gateH * 0.4);
        this.ctx.lineTo(gx + gateW * 0.5, gateY + gateH * 0.02);
        this.ctx.lineTo(gx + gateW * 0.9, gateY + gateH * 0.4);
        this.ctx.lineTo(gx + gateW, gateY + gateH);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(gx + gateW * 0.5, gateY + gateH * 0.02);
        this.ctx.lineTo(gx + gateW * 0.5, gateY + gateH);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(gx + gateW * 0.5, gateY + gateH * 0.52, gateW * 0.06, 0, Math.PI * 2);
        this.ctx.stroke();
        [[0.04, 0.08], [0.18, 0.12], [0.35, 0.15]].forEach(([ty, th]) => {
            this.ctx.beginPath();
            this.ctx.moveTo(gx + gateW * 0.1, gateY + gateH * ty);
            this.ctx.quadraticCurveTo(gx + gateW * 0.5, gateY + gateH * (ty - 0.03), gx + gateW * 0.9, gateY + gateH * ty);
            this.ctx.lineTo(gx + gateW * 0.9, gateY + gateH * (ty + th));
            this.ctx.quadraticCurveTo(gx + gateW * 0.5, gateY + gateH * (ty + th + 0.015), gx + gateW * 0.1, gateY + gateH * (ty + th));
            this.ctx.closePath();
            this.ctx.stroke();
        });
        this.ctx.strokeRect(gx + gateW * 0.2, gateY - 20, gateW * 0.6, gateH * 0.5);
        for (let r = 1; r < 3; r++) {
            this.ctx.beginPath();
            this.ctx.moveTo(gx + gateW * 0.2, gateY - 20 + (gateH * 0.5 * r) / 3);
            this.ctx.lineTo(gx + gateW * 0.8, gateY - 20 + (gateH * 0.5 * r) / 3);
            this.ctx.stroke();
        }
        for (let c = 1; c < 4; c++) {
            const cx = gx + gateW * 0.2 + (gateW * 0.6 * c) / 4;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, gateY - 20);
            this.ctx.lineTo(cx, gateY - 20 + gateH * 0.5);
            this.ctx.stroke();
        }
        
        this.cars.forEach(car => {
            const t = car.depth;
            const y = vpY + (h - vpY) * t;
            const scale = 1 - t * 0.88;
            const carW = 72 * scale;
            const carH = 28 * scale;
            const xNorm = roadLeft + (roadRight - roadLeft) * (0.15 + car.phase * 0.7);
            const x = project(xNorm, y) - carW / 2;
            this.ctx.strokeRect(x, y - carH, carW, carH);
            this.ctx.beginPath();
            this.ctx.moveTo(x + carW * 0.22, y - carH);
            this.ctx.lineTo(x + carW * 0.22, y);
            this.ctx.moveTo(x + carW * 0.78, y - carH);
            this.ctx.lineTo(x + carW * 0.78, y);
            this.ctx.stroke();
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
    }
}

// Urbanity Visual
class UrbanityVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.buildings = [];
        this.lights = [];
        this.initBuildings();
    }
    
    initBuildings() {
        let x = 0;
        while (x < this.width + 100) {
            const width = 40 + Math.random() * 80;
            const height = 100 + Math.random() * (this.height * 0.7);
            this.buildings.push({
                x: x,
                width: width,
                height: height,
                color: `hsl(200, 30%, ${10 + Math.random() * 20}%)`
            });
            
            const windows = Math.floor(height / 30);
            for (let i = 0; i < windows; i++) {
                if (Math.random() > 0.3) {
                    this.lights.push({
                        x: x + width / 2,
                        y: this.height - height + i * 30 + 15,
                        buildingX: x,
                        buildingWidth: width,
                        on: Math.random() > 0.5,
                        flicker: Math.random() * Math.PI * 2
                    });
                }
            }
            
            x += width + 5;
        }
    }
    
    update() {
        super.update();
        this.lights.forEach(light => {
            light.flicker += 0.1;
            if (Math.random() < 0.001) {
                light.on = !light.on;
            }
        });
    }
    
    render() {
        // Night sky
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        skyGradient.addColorStop(0, '#0a0a1a');
        skyGradient.addColorStop(1, '#1a1a2e');
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Stars
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 100; i++) {
            const x = (i * 37) % this.width;
            const y = (i * 73) % (this.height * 0.5);
            const twinkle = Math.sin(this.time * 2 + i) * 0.5 + 0.5;
            this.ctx.globalAlpha = twinkle * 0.8;
            this.ctx.fillRect(x, y, 1, 1);
        }
        this.ctx.globalAlpha = 1;
        
        // Buildings
        this.buildings.forEach(building => {
            this.ctx.fillStyle = building.color;
            this.ctx.fillRect(
                building.x,
                this.height - building.height,
                building.width,
                building.height
            );
        });
        
        this.lights.forEach(light => {
            if (light.on) {
                const brightness = 0.5 + Math.sin(light.flicker) * 0.3;
                this.ctx.fillStyle = `rgba(255, 220, 100, ${brightness})`;
                this.ctx.fillRect(light.x - 3, light.y - 3, 6, 6);
                
                const glowGradient = this.ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, 10);
                glowGradient.addColorStop(0, `rgba(255, 220, 100, ${brightness * 0.3})`);
                glowGradient.addColorStop(1, 'transparent');
                this.ctx.fillStyle = glowGradient;
                this.ctx.fillRect(light.x - 10, light.y - 10, 20, 20);
            }
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.buildings = [];
        this.lights = [];
        this.initBuildings();
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new VisualScreensaver();
});

