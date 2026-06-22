import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function createBeam(width, height) {
  const angle = -38 + Math.random() * 14;
  return {
    x:          Math.random() * width * 1.4 - width * 0.2,
    y:          Math.random() * height * 1.5 - height * 0.25,
    width:      40 + Math.random() * 80,
    length:     height * 2.8,
    angle,
    speed:      0.4 + Math.random() * 0.9,
    opacity:    0.08 + Math.random() * 0.12,
    hue:        210 + Math.random() * 50,  // 210–260 → azul → índigo
    pulse:      Math.random() * Math.PI * 2,
    pulseSpeed: 0.015 + Math.random() * 0.025,
  };
}

function resetBeam(beam, index, totalBeams, canvasW, canvasH) {
  const col     = index % 3;
  const spacing = canvasW / 3;
  beam.y        = canvasH + 120;
  beam.x        = col * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
  beam.width    = 80 + Math.random() * 120;
  beam.speed    = 0.4 + Math.random() * 0.5;
  beam.hue      = 210 + (index * 50) / totalBeams;
  beam.opacity  = 0.1 + Math.random() * 0.12;
  return beam;
}

function drawBeam(ctx, beam, globalOpacity) {
  ctx.save();
  ctx.translate(beam.x, beam.y);
  ctx.rotate((beam.angle * Math.PI) / 180);

  const pulsed   = beam.opacity * (0.75 + Math.sin(beam.pulse) * 0.25) * globalOpacity;
  const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);
  gradient.addColorStop(0,   `hsla(${beam.hue}, 90%, 65%, 0)`);
  gradient.addColorStop(0.1, `hsla(${beam.hue}, 90%, 65%, ${pulsed * 0.4})`);
  gradient.addColorStop(0.4, `hsla(${beam.hue}, 90%, 65%, ${pulsed})`);
  gradient.addColorStop(0.6, `hsla(${beam.hue}, 90%, 65%, ${pulsed})`);
  gradient.addColorStop(0.9, `hsla(${beam.hue}, 90%, 65%, ${pulsed * 0.4})`);
  gradient.addColorStop(1,   `hsla(${beam.hue}, 90%, 65%, 0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
  ctx.restore();
}

export function BeamsBackground({ className, intensity = "medium" }) {
  const canvasRef = useRef(null);
  const beamsRef  = useRef([]);
  const rafRef    = useRef(0);

  const opacityMap = { subtle: 0.6, medium: 0.85, strong: 1 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr      = window.devicePixelRatio || 1;
      const w        = window.innerWidth;
      const h        = window.innerHeight;
      canvas.width   = w * dpr;
      canvas.height  = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      beamsRef.current = Array.from({ length: 22 }, () => createBeam(w, h));
    };

    resize();
    window.addEventListener("resize", resize);

    const go = opacityMap[intensity] ?? 0.85;

    const animate = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);
      ctx.filter = "blur(32px)";

      const total = beamsRef.current.length;
      beamsRef.current.forEach((beam, i) => {
        beam.y     -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -100) resetBeam(beam, i, total, w, h);
        drawBeam(ctx, beam, go);
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [intensity]);

  return (
    <div className={cn("fixed inset-0 overflow-hidden pointer-events-none", className)}
         style={{ zIndex: 0 }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
