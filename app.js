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
            urbanity: UrbanityVisual
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
        const types = ['mosaic', 'smoke', 'lightshade', 'lanterns', 'sunset', 'bloom', 'urbanity'];
        types.forEach(type => {
            const preview = document.getElementById(`preview-${type}`);
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            preview.appendChild(canvas);
            
            const VisualClass = this.getVisualClass(type);
            const visual = new VisualClass(canvas, ctx);
            
            let lastTime = 0;
            const previewAnimate = (time) => {
                if (time - lastTime > 16) { // ~60fps
                    visual.update();
                    visual.render();
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

// Lanterns Visual
class LanternsVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.lanterns = [];
        this.initLanterns();
    }
    
    initLanterns() {
        const s = this.scale;
        const count = Math.min(35, Math.max(15, Math.floor(15 * s)));
        for (let i = 0; i < count; i++) {
            this.lanterns.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: (30 + Math.random() * 40) * s,
                swing: Math.random() * Math.PI * 2,
                swingSpeed: 0.02 + Math.random() * 0.03,
                floatSpeed: (0.3 + Math.random() * 0.5) * s,
                hue: 30 + Math.random() * 60,
                brightness: 0.7 + Math.random() * 0.3
            });
        }
    }
    
    update() {
        super.update();
        const s = this.scale;
        this.lanterns.forEach(lantern => {
            lantern.swing += lantern.swingSpeed;
            lantern.x += Math.sin(lantern.swing) * 2 * s;
            lantern.y -= lantern.floatSpeed;
            
            if (lantern.y < -lantern.radius * 2) {
                lantern.y = this.height + lantern.radius;
                lantern.x = Math.random() * this.width;
            }
        });
    }
    
    render() {
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.lanterns.forEach(lantern => {
            // Glow
            const glowGradient = this.ctx.createRadialGradient(
                lantern.x, lantern.y, 0,
                lantern.x, lantern.y, lantern.radius * 3
            );
            glowGradient.addColorStop(0, `hsla(${lantern.hue}, 100%, ${lantern.brightness * 100}%, 0.6)`);
            glowGradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(lantern.x, lantern.y, lantern.radius * 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Lantern body
            const bodyGradient = this.ctx.createRadialGradient(
                lantern.x, lantern.y - lantern.radius * 0.3, 0,
                lantern.x, lantern.y, lantern.radius
            );
            bodyGradient.addColorStop(0, `hsla(${lantern.hue}, 100%, 70%, 1)`);
            bodyGradient.addColorStop(1, `hsla(${lantern.hue}, 80%, 40%, 0.8)`);
            
            this.ctx.fillStyle = bodyGradient;
            this.ctx.beginPath();
            this.ctx.ellipse(lantern.x, lantern.y, lantern.radius, lantern.radius * 1.2, 0, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.initLanterns();
    }
}

// Sunset Visual
class SunsetVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
    }
    
    render() {
        const s = this.scale;
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
        sunGradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = sunGradient;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunGlowR, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunDiskR, 0, Math.PI * 2);
        this.ctx.fill();
        
        const cloudCount = Math.min(9, Math.max(5, Math.floor(5 * s)));
        for (let i = 0; i < cloudCount; i++) {
            const cloudX = (this.time * 10 * s + i * 300 * s) % (this.width + 200 * s) - 100 * s;
            const cloudY = this.height * 0.4 + i * 50 * s;
            const cloudOpacity = 0.3 + Math.sin(this.time + i) * 0.1;
            const r1 = 40 * s, r2 = 50 * s, r3 = 40 * s;
            this.ctx.fillStyle = `rgba(255, 200, 150, ${cloudOpacity})`;
            this.ctx.beginPath();
            this.ctx.arc(cloudX, cloudY, r1, 0, Math.PI * 2);
            this.ctx.arc(cloudX + 50 * s, cloudY, r2, 0, Math.PI * 2);
            this.ctx.arc(cloudX + 100 * s, cloudY, r3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}

// Bloom Visual
class BloomVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.flowers = [];
        this.initFlowers();
    }
    
    initFlowers() {
        const s = this.scale;
        const count = Math.min(22, Math.max(8, Math.floor(8 * s)));
        for (let i = 0; i < count; i++) {
            this.flowers.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                petals: 5 + Math.floor(Math.random() * 4),
                size: (40 + Math.random() * 60) * s,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                hue: Math.random() * 360,
                pulse: Math.random() * Math.PI * 2
            });
        }
    }
    
    update() {
        super.update();
        this.flowers.forEach(flower => {
            flower.rotation += flower.rotationSpeed;
            flower.pulse += 0.05;
        });
    }
    
    render() {
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.flowers.forEach(flower => {
            const scale = 1 + Math.sin(flower.pulse) * 0.2;
            const currentSize = flower.size * scale;
            
            this.ctx.save();
            this.ctx.translate(flower.x, flower.y);
            this.ctx.rotate(flower.rotation);
            
            // Draw petals
            for (let i = 0; i < flower.petals; i++) {
                const angle = (Math.PI * 2 / flower.petals) * i;
                const petalX = Math.cos(angle) * currentSize * 0.6;
                const petalY = Math.sin(angle) * currentSize * 0.6;
                
                const petalGradient = this.ctx.createRadialGradient(petalX, petalY, 0, petalX, petalY, currentSize * 0.4);
                petalGradient.addColorStop(0, `hsla(${flower.hue}, 80%, 70%, 0.9)`);
                petalGradient.addColorStop(1, `hsla(${flower.hue}, 60%, 50%, 0.3)`);
                
                this.ctx.fillStyle = petalGradient;
                this.ctx.beginPath();
                this.ctx.ellipse(petalX, petalY, currentSize * 0.3, currentSize * 0.5, angle, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // Center
            this.ctx.fillStyle = `hsl(${flower.hue + 30}, 70%, 50%)`;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, currentSize * 0.15, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    resize(width, height) {
        super.resize(width, height);
        this.initFlowers();
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

