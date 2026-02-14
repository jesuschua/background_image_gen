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

// Base Visual Class
class BaseVisual {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.width = canvas.width;
        this.height = canvas.height;
        this.time = 0;
    }
    
    resize(width, height) {
        this.width = width;
        this.height = height;
    }
    
    update() {
        this.time += 0.016; // ~60fps
    }
    
    render() {
        // Override in subclasses
    }
}

// Mosaic Visual
class MosaicVisual extends BaseVisual {
    constructor(canvas, ctx) {
        super(canvas, ctx);
        this.tileSize = 40;
        this.colors = [
            [102, 126, 234],
            [118, 75, 162],
            [237, 100, 166],
            [255, 154, 158],
            [250, 208, 196]
        ];
    }
    
    render() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        const cols = Math.ceil(this.width / this.tileSize) + 1;
        const rows = Math.ceil(this.height / this.tileSize) + 1;
        
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const offsetX = (this.time * 20 + x * this.tileSize) % (this.tileSize * 2);
                const offsetY = (this.time * 15 + y * this.tileSize) % (this.tileSize * 2);
                
                const colorIndex = Math.floor((x + y + this.time * 2) % this.colors.length);
                const color = this.colors[colorIndex];
                const brightness = 0.3 + 0.7 * (Math.sin(this.time + x + y) * 0.5 + 0.5);
                
                this.ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${brightness})`;
                this.ctx.fillRect(
                    x * this.tileSize - offsetX,
                    y * this.tileSize - offsetY,
                    this.tileSize,
                    this.tileSize
                );
            }
        }
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
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: this.height + Math.random() * 200,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -0.5 - Math.random() * 1.5,
                size: 20 + Math.random() * 80,
                opacity: 0.1 + Math.random() * 0.3,
                life: Math.random()
            });
        }
    }
    
    update() {
        super.update();
        this.particles.forEach(p => {
            p.x += p.vx + Math.sin(this.time + p.life) * 0.3;
            p.y += p.vy;
            p.opacity *= 0.998;
            p.size *= 1.001;
            
            if (p.y < -p.size || p.opacity < 0.01) {
                p.x = Math.random() * this.width;
                p.y = this.height + Math.random() * 100;
                p.opacity = 0.2 + Math.random() * 0.3;
                p.size = 20 + Math.random() * 80;
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
        for (let i = 0; i < 5; i++) {
            this.lights.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 100 + Math.random() * 200,
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
        for (let i = 0; i < 15; i++) {
            this.lanterns.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 30 + Math.random() * 40,
                swing: Math.random() * Math.PI * 2,
                swingSpeed: 0.02 + Math.random() * 0.03,
                floatSpeed: 0.3 + Math.random() * 0.5,
                hue: 30 + Math.random() * 60,
                brightness: 0.7 + Math.random() * 0.3
            });
        }
    }
    
    update() {
        super.update();
        this.lanterns.forEach(lantern => {
            lantern.swing += lantern.swingSpeed;
            lantern.x += Math.sin(lantern.swing) * 2;
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
        // Sky gradient
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        const sunY = this.height * 0.3 + Math.sin(this.time * 0.1) * 50;
        const sunX = this.width * 0.5;
        
        skyGradient.addColorStop(0, '#1a1a2e');
        skyGradient.addColorStop(0.3, '#16213e');
        skyGradient.addColorStop(0.5, '#e94560');
        skyGradient.addColorStop(0.7, '#ff6b6b');
        skyGradient.addColorStop(1, '#ffa500');
        
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Sun
        const sunGradient = this.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 150);
        sunGradient.addColorStop(0, '#fff8dc');
        sunGradient.addColorStop(0.5, '#ffd700');
        sunGradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = sunGradient;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, 150, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Sun disk
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Clouds
        for (let i = 0; i < 5; i++) {
            const cloudX = (this.time * 10 + i * 300) % (this.width + 200) - 100;
            const cloudY = this.height * 0.4 + i * 50;
            const cloudOpacity = 0.3 + Math.sin(this.time + i) * 0.1;
            
            this.ctx.fillStyle = `rgba(255, 200, 150, ${cloudOpacity})`;
            this.ctx.beginPath();
            this.ctx.arc(cloudX, cloudY, 40, 0, Math.PI * 2);
            this.ctx.arc(cloudX + 50, cloudY, 50, 0, Math.PI * 2);
            this.ctx.arc(cloudX + 100, cloudY, 40, 0, Math.PI * 2);
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
        for (let i = 0; i < 8; i++) {
            this.flowers.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                petals: 5 + Math.floor(Math.random() * 4),
                size: 40 + Math.random() * 60,
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
            
            // Add windows
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
        
        // Window lights
        this.lights.forEach(light => {
            if (light.on) {
                const brightness = 0.5 + Math.sin(light.flicker) * 0.3;
                this.ctx.fillStyle = `rgba(255, 220, 100, ${brightness})`;
                this.ctx.fillRect(
                    light.x - 3,
                    light.y - 3,
                    6,
                    6
                );
                
                // Glow
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

