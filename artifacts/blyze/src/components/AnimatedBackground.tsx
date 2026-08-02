import { useEffect, useRef } from 'react';
import { useThemeStore } from '../store/theme';

const THEME_HEX: Record<string, string> = {
  cyan:   '#00e5ff',
  pink:   '#ff00aa',
  green:  '#00ff87',
  purple: '#bb00ff',
  orange: '#ff6600',
};

interface Star {
  x: number; y: number;
  size: number; alpha: number;
  speed: number; phase: number;
}
interface ShootingStar {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number;
}
interface Nebula {
  x: number; y: number;
  r: number; alpha: number;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let stars: Star[] = [];
    let nebulae: Nebula[] = [];
    let shooters: ShootingStar[] = [];
    let frame = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const W = canvas.width, H = canvas.height;
      const count = Math.min(350, Math.floor((W * H) / 5000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 1.6 + 0.2,
        alpha: Math.random() * 0.5 + 0.15,
        speed: Math.random() * 0.04 + 0.008,
        phase: Math.random() * Math.PI * 2,
      }));
      nebulae = Array.from({ length: 5 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 280 + 120,
        alpha: Math.random() * 0.055 + 0.015,
      }));
    };

    const spawnShooter = () => {
      const a = (Math.random() * 35 + 12) * (Math.PI / 180);
      shooters.push({
        x: Math.random() * canvas.width * 0.7,
        y: Math.random() * canvas.height * 0.4,
        vx: Math.cos(a) * 14,
        vy: Math.sin(a) * 14,
        alpha: 1,
      });
    };

    window.addEventListener('resize', resize);
    resize();

    const render = () => {
      frame++;
      const W = canvas.width, H = canvas.height;
      const hex = THEME_HEX[theme] || '#00e5ff';

      ctx.clearRect(0, 0, W, H);

      // Nebulae
      nebulae.forEach(n => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        const a = Math.round(n.alpha * 255).toString(16).padStart(2, '0');
        g.addColorStop(0, hex + a);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Stars
      stars.forEach(s => {
        const tw = Math.sin(frame * s.speed + s.phase) * 0.28 + 0.72;
        const a = Math.min(1, s.alpha * tw);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        if (s.size > 1.1) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = hex;
        }
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Shooting stars
      if (frame % 200 === 0 && Math.random() > 0.3) spawnShooter();
      shooters = shooters.filter(ss => {
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.alpha -= 0.02;
        if (ss.alpha <= 0 || ss.x > W || ss.y > H) return false;
        const g = ctx.createLinearGradient(ss.x - ss.vx * 6, ss.y - ss.vy * 6, ss.x, ss.y);
        g.addColorStop(0, 'transparent');
        g.addColorStop(1, `rgba(255,255,255,${ss.alpha})`);
        ctx.beginPath();
        ctx.moveTo(ss.x - ss.vx * 6, ss.y - ss.vy * 6);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = hex;
        ctx.stroke();
        ctx.shadowBlur = 0;
        return true;
      });

      raf = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.45, mixBlendMode: 'screen' }}
    />
  );
}
