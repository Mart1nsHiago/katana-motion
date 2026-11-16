import { dailySeed, seededRandom, segmentCircleHit } from './math';
import { INITIAL_SNAPSHOT } from './types';
import type { GameMode, GameSnapshot, Point } from './types';

type FruitType = 'citrus' | 'apple' | 'melon' | 'lemon' | 'peach' | 'plum';
type Kind = 'fruit' | 'bomb' | 'heart';

type FlyingItem = {
  id: number;
  kind: Kind;
  fruit: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  spin: number;
};

type Fragment = {
  fruit: FruitType;
  side: -1 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  spin: number;
  alpha: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  color: string;
};

type FloatText = { x: number; y: number; text: string; color: string; life: number };
type Trail = { from: Point; to: Point; color: string; life: number };

const FRUITS: FruitType[] = ['citrus', 'apple', 'melon', 'lemon', 'peach', 'plum'];
const FRUIT_COLORS: Record<FruitType, string> = {
  citrus: '#ffad4b', apple: '#f44b56', melon: '#61dc93',
  lemon: '#f4db65', peach: '#ff8790', plum: '#b687f1',
};

type EngineOptions = {
  gameMode: GameMode;
  reducedEffects: boolean;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onEnd: (snapshot: GameSnapshot) => void;
  onSound: (kind: 'slice' | 'hit' | 'life') => void;
};

export class GameEngine {
  width = 1100;
  height = 600;
  active = true;
  private items: FlyingItem[] = [];
  private fragments: Fragment[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatText[] = [];
  private trails: Trail[] = [];
  private id = 0;
  private random: () => number;
  private snapshot: GameSnapshot = { ...INITIAL_SNAPSHOT };
  private spawnClock = 0.8;
  private lastFruitHit = -100;
  private lastSwing = -100;
  private lastPublished = 0;
  private options: EngineOptions;

  constructor(options: EngineOptions) {
    this.options = options;
    this.random = options.gameMode === 'daily' ? seededRandom(dailySeed()) : Math.random;
    this.options.onSnapshot({ ...this.snapshot });
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    const oldWidth = this.width;
    const oldHeight = this.height;
    if (this.items.length) {
      for (const item of this.items) {
        item.x = (item.x / oldWidth) * width;
        item.y = (item.y / oldHeight) * height;
      }
    }
    this.width = width;
    this.height = height;
  }

  getSnapshot() { return { ...this.snapshot }; }

  update(dt: number) {
    if (!this.active) return;
    const step = Math.min(dt, 0.05);
    this.snapshot.elapsed += step;
    this.spawnClock -= step;

    if (this.spawnClock <= 0) {
      this.spawnWave();
      const difficulty = Math.min(this.snapshot.elapsed / 140, 0.32);
      this.spawnClock = Math.max(0.48, 1.15 - difficulty - this.random() * 0.25);
    }

    const gravity = this.height * 1.18;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.x += item.vx * step;
      item.y += item.vy * step;
      item.vy += gravity * step;
      item.rotation += item.spin * step;
      if (item.y - item.radius > this.height + 40 && item.vy > 0) {
        this.items.splice(i, 1);
        if (item.kind === 'fruit') this.loseLife('miss');
      }
    }

    for (const piece of this.fragments) {
      piece.x += piece.vx * step;
      piece.y += piece.vy * step;
      piece.vy += gravity * 0.75 * step;
      piece.rotation += piece.spin * step;
      piece.alpha -= step * 0.8;
    }
    this.fragments = this.fragments.filter(piece => piece.alpha > 0);

    for (const particle of this.particles) {
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.vy += gravity * 0.32 * step;
      particle.life -= step * 1.45;
    }
    this.particles = this.particles.filter(particle => particle.life > 0);

    for (const word of this.floatingTexts) { word.y -= 35 * step; word.life -= step * 1.15; }
    this.floatingTexts = this.floatingTexts.filter(word => word.life > 0);
    for (const trail of this.trails) trail.life -= step * 3.4;
    this.trails = this.trails.filter(trail => trail.life > 0);

    if (this.snapshot.elapsed - this.lastFruitHit > 1.45 && this.snapshot.combo !== 1) {
      this.snapshot.combo = 1;
    }
    this.publish(false);
  }

  slash(from: Point, to: Point, source: 'camera' | 'mouse') {
    if (!this.active) return;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance < (source === 'camera' ? 10 : 6) || distance > this.width * 0.5) return;
    const timestamp = this.snapshot.elapsed;
    if (timestamp - this.lastSwing > 0.13) {
      this.snapshot.swings += 1;
      this.lastSwing = timestamp;
    }
    this.trails.push({ from: { ...from }, to: { ...to }, color: source === 'camera' ? '#dcff76' : '#f3dfab', life: 1 });
    if (this.trails.length > 28) this.trails.shift();

    let hasHit = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!segmentCircleHit(from, to, item, item.radius * 0.82)) continue;
      this.items.splice(i, 1);
      hasHit = true;
      if (item.kind === 'bomb') {
        this.snapshot.bombs += 1;
        this.burst(item.x, item.y, '#ff685c', 30);
        this.floatingTexts.push({ x: item.x, y: item.y, text: 'BOOM!', color: '#ff7c70', life: 1 });
        this.options.onSound('hit');
        this.loseLife('bomb');
      } else if (item.kind === 'heart') {
        this.snapshot.lives = Math.min(5, this.snapshot.lives + 1);
        this.burst(item.x, item.y, '#fd7a9f', 24);
        this.floatingTexts.push({ x: item.x, y: item.y, text: '+1 VIDA', color: '#fc9db1', life: 1 });
        this.options.onSound('life');
      } else {
        this.snapshot.combo = timestamp - this.lastFruitHit <= 1.45 ? Math.min(this.snapshot.combo + 1, 8) : 1;
        this.snapshot.maxCombo = Math.max(this.snapshot.maxCombo, this.snapshot.combo);
        this.lastFruitHit = timestamp;
        const points = 10 * this.snapshot.combo;
        this.snapshot.score += points;
        this.snapshot.fruitHits += 1;
        this.makeFragments(item);
        this.burst(item.x, item.y, FRUIT_COLORS[item.fruit], this.options.reducedEffects ? 5 : 15);
        this.floatingTexts.push({
          x: item.x, y: item.y - item.radius,
          text: `+${points}${this.snapshot.combo > 1 ? `  x${this.snapshot.combo}` : ''}`,
          color: '#dfff78', life: 1,
        });
        this.options.onSound('slice');
      }
    }
    if (hasHit) this.publish(true);
  }

  render(ctx: CanvasRenderingContext2D, showTrail: boolean) {
    ctx.clearRect(0, 0, this.width, this.height);
    for (const fragment of this.fragments) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fragment.alpha);
      ctx.translate(fragment.x, fragment.y);
      ctx.rotate(fragment.rotation);
      ctx.beginPath();
      ctx.rect(fragment.side < 0 ? -fragment.radius * 1.4 : 0, -fragment.radius * 1.5, fragment.radius * 1.4, fragment.radius * 3);
      ctx.clip();
      drawFruit(ctx, fragment.fruit, fragment.radius);
      ctx.restore();
    }
    for (const item of this.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      if (item.kind === 'bomb') drawBomb(ctx, item.radius);
      else if (item.kind === 'heart') drawHeart(ctx, item.radius);
      else drawFruit(ctx, item.fruit, item.radius);
      ctx.restore();
    }

    for (const particle of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 11;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (showTrail) {
      for (const trail of this.trails) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, trail.life) * 0.95;
        ctx.lineCap = 'round';
        ctx.shadowColor = trail.color;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = trail.color;
        ctx.lineWidth = 3.5 * trail.life + 1;
        ctx.beginPath(); ctx.moveTo(trail.from.x, trail.from.y); ctx.lineTo(trail.to.x, trail.to.y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();
      }
    }
    for (const word of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, word.life * 1.7);
      ctx.font = '800 23px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(9, 12, 9, 0.8)'; ctx.lineWidth = 5;
      ctx.strokeText(word.text, word.x, word.y);
      ctx.fillStyle = word.color; ctx.fillText(word.text, word.x, word.y);
      ctx.restore();
    }
  }

  private spawnWave() {
    const count = this.random() < 0.28 ? 2 : this.random() < 0.1 ? 3 : 1;
    const scale = Math.min(1.3, Math.max(0.65, this.width / 1100));
    for (let i = 0; i < count; i++) {
      const chance = this.random();
      const kind: Kind = chance < 0.075 ? 'bomb' : chance < 0.098 && this.snapshot.lives < 5 ? 'heart' : 'fruit';
      const x = this.width * (0.13 + this.random() * 0.74);
      const speedY = this.height * (1.1 + this.random() * 0.22);
      this.items.push({
        id: ++this.id, kind,
        fruit: FRUITS[Math.floor(this.random() * FRUITS.length)],
        x: x + (i - (count - 1) / 2) * 65 * scale,
        y: this.height + 55 * scale,
        vx: (this.width * 0.5 - x) * (0.20 + this.random() * 0.12),
        vy: -speedY,
        radius: (28 + this.random() * 10) * scale,
        rotation: this.random() * Math.PI,
        spin: (this.random() - 0.5) * 3.4,
      });
    }
  }

  private makeFragments(item: FlyingItem) {
    for (const side of [-1, 1] as const) {
      this.fragments.push({
        fruit: item.fruit, side,
        x: item.x + side * 7, y: item.y,
        vx: item.vx + side * 145, vy: item.vy * 0.45 - 70,
        radius: item.radius, rotation: item.rotation,
        spin: item.spin + side * 4, alpha: 1,
      });
    }
  }

  private burst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = 35 + this.random() * 210;
      this.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        radius: 2 + this.random() * 4.5, life: 0.65 + this.random() * 0.45, color,
      });
    }
  }

  private loseLife(reason: 'miss' | 'bomb') {
    if (!this.active) return;
    this.snapshot.lives = Math.max(0, this.snapshot.lives - 1);
    if (reason === 'miss') this.snapshot.misses += 1;
    if (this.snapshot.lives === 0) {
      this.active = false;
      this.publish(true);
      this.options.onEnd({ ...this.snapshot });
    } else this.publish(true);
  }

  private publish(force: boolean) {
    const now = performance.now();
    if (force || now - this.lastPublished > 100) {
      this.lastPublished = now;
      this.options.onSnapshot({ ...this.snapshot });
    }
  }
}

function gradient(ctx: CanvasRenderingContext2D, r: number, light: string, dark: string) {
  const result = ctx.createRadialGradient(-r * 0.45, -r * 0.5, 2, 0, 0, r * 1.25);
  result.addColorStop(0, light);
  result.addColorStop(1, dark);
  return result;
}

function drawFruit(ctx: CanvasRenderingContext2D, fruit: FruitType, r: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.26)'; ctx.shadowBlur = 13; ctx.shadowOffsetY = 8;
  if (fruit === 'lemon') {
    ctx.fillStyle = gradient(ctx, r, '#fff4a0', '#e9ba32');
    ctx.beginPath();
    ctx.moveTo(-r * 1.15, -r * 0.08);
    ctx.bezierCurveTo(-r * 0.85, -r * 0.95, r * 0.85, -r * 0.95, r * 1.15, -r * 0.08);
    ctx.bezierCurveTo(r * 0.85, r * 0.95, -r * 0.85, r * 0.95, -r * 1.15, -r * 0.08);
    ctx.fill();
  } else if (fruit === 'apple' || fruit === 'peach') {
    ctx.fillStyle = fruit === 'apple' ? gradient(ctx, r, '#ff8e83', '#d82e45') : gradient(ctx, r, '#ffd2a0', '#f06679');
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.68);
    ctx.bezierCurveTo(-r * 0.75, -r * 1.30, -r * 1.2, -r * 0.42, -r * 0.94, r * 0.45);
    ctx.bezierCurveTo(-r * 0.7, r * 1.32, -r * 0.17, r * 0.95, 0, r * 0.88);
    ctx.bezierCurveTo(r * 0.26, r * 1.07, r * 0.77, r * 1.2, r * 0.98, r * 0.3);
    ctx.bezierCurveTo(r * 1.16, -r * 0.63, r * 0.64, -r * 1.27, 0, -r * 0.68);
    ctx.fill();
  } else {
    const colors: Record<'citrus' | 'melon' | 'plum', [string, string]> = {
      citrus: ['#ffdd83', '#f48c2b'], melon: ['#b8ff8b', '#2b9b74'], plum: ['#ddb2ff', '#8e5cc9'],
    };
    const [light, dark] = colors[fruit];
    ctx.fillStyle = gradient(ctx, r, light, dark);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.97, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (fruit === 'melon') {
    ctx.strokeStyle = 'rgba(16,99,66,.36)'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.ellipse(i * r * 0.20, 0, r * 0.30, r * 0.84, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
  }
  if (fruit === 'citrus') {
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 10; i++) { const a = i * 2.4; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.60, Math.sin(a) * r * 0.64, r * 0.045, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.34)';
  ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.36, r * 0.13, r * 0.27, -0.75, 0, Math.PI * 2); ctx.fill();
  if (fruit !== 'lemon') {
    ctx.strokeStyle = '#68502f'; ctx.lineWidth = Math.max(2, r * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.73); ctx.quadraticCurveTo(r * .08, -r * 1.12, r * .18, -r * 1.18); ctx.stroke();
    ctx.fillStyle = '#89d96b';
    ctx.beginPath(); ctx.ellipse(r * 0.30, -r * 1.06, r * .34, r * .15, -.48, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBomb(ctx: CanvasRenderingContext2D, r: number) {
  ctx.save();
  ctx.shadowColor = '#e75b4a'; ctx.shadowBlur = 22;
  ctx.fillStyle = gradient(ctx, r, '#777c7b', '#252d2b');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#b8bcba'; ctx.fillRect(-r * .23, -r * 1.08, r * .46, r * .35);
  ctx.strokeStyle = '#ffe6b2'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.quadraticCurveTo(r * .45, -r * 1.46, r * .43, -r * 1.6); ctx.stroke();
  ctx.fillStyle = '#f8a549'; ctx.beginPath(); ctx.arc(r * .43, -r * 1.6, r * .15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eff3d9'; ctx.font = `800 ${r * 0.85}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×', 0, 2);
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, r: number) {
  ctx.save(); ctx.scale(r / 30, r / 30);
  ctx.fillStyle = '#ff6c87'; ctx.shadowColor = '#ff6c87'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.moveTo(0, 25);
  ctx.bezierCurveTo(-40, -2, -27, -28, -8, -20);
  ctx.bezierCurveTo(-3, -18, 0, -12, 0, -12);
  ctx.bezierCurveTo(0, -12, 6, -23, 16, -22);
  ctx.bezierCurveTo(40, -19, 35, 6, 0, 25); ctx.fill();
  ctx.restore();
}
