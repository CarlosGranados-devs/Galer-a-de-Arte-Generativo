import type { Algorithm, Palette } from '../models/ArtworkModel';

const BASE = 1000;
const TAU = Math.PI * 2;

export interface ArtworkSpec {
  algorithm: Algorithm;
  palette: Palette;
  seed: number;
  complexity: number;
}

export interface PaletteDefinition {
  background: string;
  backgroundAlt: string;
  glow: string;
  swatch: string;
  colors: readonly [string, string, string, string, string];
}

/** Paletas curadas: un fondo profundo por familia cromática y cinco tintas. */
export const PALETTE_DEFINITIONS: Record<Palette, PaletteDefinition> = {
  Cyberpunk: {
    background: '#08060f',
    backgroundAlt: '#04030a',
    glow: '#8b5cf6',
    swatch: '#ff2e88',
    colors: ['#ff2e88', '#22d3ee', '#a855f7', '#fde047', '#34d399'],
  },
  Terracota: {
    background: '#1b110c',
    backgroundAlt: '#0b0605',
    glow: '#e07a5f',
    swatch: '#e07a5f',
    colors: ['#e07a5f', '#f2cc8f', '#d97757', '#b07d62', '#f4a261'],
  },
  Nordic: {
    background: '#0a1524',
    backgroundAlt: '#050a11',
    glow: '#5e81ac',
    swatch: '#88c0d0',
    colors: ['#88c0d0', '#81a1c1', '#5e81ac', '#a3be8c', '#ebcb8b'],
  },
  Solaris: {
    background: '#170f03',
    backgroundAlt: '#090501',
    glow: '#fb8500',
    swatch: '#ffb703',
    colors: ['#ffb703', '#fb8500', '#ffd166', '#ef476f', '#f8f9fa'],
  },
  Monocromo: {
    background: '#111114',
    backgroundAlt: '#060607',
    glow: '#a1a1aa',
    swatch: '#fafafa',
    colors: ['#fafafa', '#e4e4e7', '#a1a1aa', '#71717a', '#d4d4d8'],
  },
};

const PALETTE_KEYS = Object.keys(PALETTE_DEFINITIONS) as Palette[];

type Rng = () => number;

/** PRNG mulberry32: rápido, determinista y suficiente para arte visual. */
function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

function pick<T>(rng: Rng, values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error('El catálogo de valores está vacío.');
  }
  return values[Math.floor(rng() * values.length) % values.length] as T;
}

function gaussian(rng: Rng): number {
  return (rng() + rng() + rng() - 1.5) / 1.5;
}

function colorAt(palette: PaletteDefinition, index: number): string {
  return palette.colors[index % palette.colors.length] ?? palette.colors[0];
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int) || full.length !== 6) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  const red = (int >> 16) & 255;
  const green = (int >> 8) & 255;
  const blue = int & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getPalette(palette: Palette): PaletteDefinition {
  return PALETTE_DEFINITIONS[palette] ?? PALETTE_DEFINITIONS.Cyberpunk;
}

function paintBackdrop(ctx: CanvasRenderingContext2D, palette: PaletteDefinition): void {
  const gradient = ctx.createLinearGradient(0, 0, BASE, BASE);
  gradient.addColorStop(0, palette.background);
  gradient.addColorStop(1, palette.backgroundAlt);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BASE, BASE);
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, withAlpha(color, alpha));
  glow.addColorStop(0.45, withAlpha(color, alpha * 0.42));
  glow.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/* ------------------------------------------------------------------ */
/* 01 · Constelación Geométrica                                        */
/* ------------------------------------------------------------------ */

interface StarNode {
  x: number;
  y: number;
  radius: number;
  color: string;
}

function drawConstellation(
  ctx: CanvasRenderingContext2D,
  palette: PaletteDefinition,
  rng: Rng,
  complexity: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const focusX = range(rng, 340, 660);
  const focusY = range(rng, 320, 640);
  drawGlow(ctx, focusX, focusY, 480, palette.glow, 0.16);
  drawGlow(ctx, range(rng, 120, 880), range(rng, 120, 880), 260, colorAt(palette, 2), 0.09);

  // Polvo estelar de fondo.
  const dust = Math.round(70 + complexity * 2.1);
  for (let index = 0; index < dust; index += 1) {
    const x = rng() * BASE;
    const y = rng() * BASE;
    const size = rng() < 0.86 ? range(rng, 0.4, 1.1) : range(rng, 1.2, 2.4);
    ctx.fillStyle = withAlpha(colorAt(palette, index), range(rng, 0.12, 0.58));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }

  // Órbitas de gran escala, casi imperceptibles.
  ctx.lineWidth = 0.7;
  for (let orbit = 0; orbit < 3; orbit += 1) {
    ctx.strokeStyle = withAlpha(colorAt(palette, orbit + 1), range(rng, 0.05, 0.1));
    ctx.beginPath();
    ctx.ellipse(
      range(rng, 380, 620),
      range(rng, 380, 620),
      range(rng, 250, 430),
      range(rng, 200, 380),
      range(rng, 0, TAU),
      0,
      TAU,
    );
    ctx.stroke();
  }

  const nodeCount = Math.round(12 + complexity * 0.34);
  const nodes: StarNode[] = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const angle = index * 2.399963 + range(rng, -0.4, 0.4);
    const radius = Math.sqrt((index + 0.6) / nodeCount) * range(rng, 300, 390);
    nodes.push({
      x: 500 + Math.cos(angle) * radius + range(rng, -36, 36),
      y: 500 + Math.sin(angle) * radius * 0.9 + range(rng, -36, 36),
      radius: range(rng, 2.4, 6.8),
      color: colorAt(palette, index),
    });
  }

  // Conexiones: cada nodo se une a sus dos vecinos más cercanos.
  const links = new Set<string>();
  for (let index = 0; index < nodes.length; index += 1) {
    const origin = nodes[index] as StarNode;
    const distances = nodes
      .map((node, nodeIndex) => ({ node, nodeIndex, distance: Math.hypot(node.x - origin.x, node.y - origin.y) }))
      .filter((entry) => entry.nodeIndex !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);

    for (const entry of distances) {
      const key = index < entry.nodeIndex ? `${index}:${entry.nodeIndex}` : `${entry.nodeIndex}:${index}`;
      if (links.has(key)) {
        continue;
      }
      links.add(key);

      const target = entry.node;
      const midX = (origin.x + target.x) / 2 + range(rng, -26, 26);
      const midY = (origin.y + target.y) / 2 + range(rng, -26, 26);

      ctx.strokeStyle = withAlpha(origin.color, range(rng, 0.2, 0.48));
      ctx.lineWidth = range(rng, 0.5, 1.35);
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.quadraticCurveTo(midX, midY, target.x, target.y);
      ctx.stroke();
    }
  }

  // Halos concéntricos en algunos nodos.
  nodes.forEach((node, index) => {
    if (rng() > 0.38) {
      return;
    }
    const ringRadius = range(rng, 10, 48);
    ctx.strokeStyle = withAlpha(node.color, range(rng, 0.12, 0.28));
    ctx.lineWidth = range(rng, 0.6, 1.2);
    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius, 0, TAU);
    ctx.stroke();
    if (index % 5 === 0) {
      ctx.strokeStyle = withAlpha(node.color, 0.18);
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringRadius * 0.55, 0, TAU);
      ctx.stroke();
    }
  });

  // Nodos luminosos.
  ctx.shadowBlur = 18;
  for (const node of nodes) {
    ctx.fillStyle = withAlpha(node.color, 0.92);
    ctx.shadowColor = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = withAlpha('#ffffff', 0.9);
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * 0.34, 0, TAU);
    ctx.fill();
  }

  // Cruces estelares sobre nodos destacados.
  const crosses = Math.max(2, Math.round(complexity / 18));
  for (let index = 0; index < crosses; index += 1) {
    const node = pick(rng, nodes);
    const length = range(rng, 14, 34);
    ctx.strokeStyle = withAlpha('#ffffff', 0.65);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(node.x - length, node.y);
    ctx.lineTo(node.x + length, node.y);
    ctx.moveTo(node.x, node.y - length);
    ctx.lineTo(node.x, node.y + length);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Estrella central con rayos.
  const core = pick(rng, nodes);
  drawGlow(ctx, core.x, core.y, 150, core.color, 0.3);
  ctx.strokeStyle = withAlpha('#ffffff', 0.5);
  ctx.lineWidth = 1;
  for (let ray = 0; ray < 4; ray += 1) {
    const angle = (ray / 4) * TAU + range(rng, -0.1, 0.1);
    ctx.beginPath();
    ctx.moveTo(core.x + Math.cos(angle) * 12, core.y + Math.sin(angle) * 12);
    ctx.lineTo(core.x + Math.cos(angle) * 70, core.y + Math.sin(angle) * 70);
    ctx.stroke();
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 02 · Ondas de Lissajous                                             */
/* ------------------------------------------------------------------ */

function drawLissajous(
  ctx: CanvasRenderingContext2D,
  palette: PaletteDefinition,
  rng: Rng,
  complexity: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const centerX = range(rng, 440, 560);
  const centerY = range(rng, 440, 560);
  drawGlow(ctx, centerX, centerY, 520, palette.glow, 0.12);

  const curveCount = Math.round(3 + complexity / 15);
  for (let index = 0; index < curveCount; index += 1) {
    const color = colorAt(palette, index);
    const a = 1 + Math.floor(rng() * 7);
    const b = 1 + Math.floor(rng() * 7);
    const delta = range(rng, 0, TAU);
    const phase = range(rng, 0, TAU);
    const radiusX = range(rng, 280, 430);
    const radiusY = range(rng, 240, 410);
    const rotation = range(rng, -0.28, 0.28);
    const steps = Math.round(760 + complexity * 4);

    const trace = () => {
      ctx.beginPath();
      for (let step = 0; step <= steps; step += 1) {
        const t = (step / steps) * TAU;
        const rawX = Math.sin(a * t + delta);
        const rawY = Math.sin(b * t + phase);
        const x = rawX * Math.cos(rotation) - rawY * Math.sin(rotation);
        const y = rawX * Math.sin(rotation) + rawY * Math.cos(rotation);
        const px = centerX + x * radiusX;
        const py = centerY + y * radiusY;
        if (step === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
    };

    // Primera pasada: bloom ancho y tenue.
    trace();
    ctx.strokeStyle = withAlpha(color, 0.08);
    ctx.lineWidth = range(rng, 5, 10);
    ctx.stroke();

    // Segunda pasada: trazo nítido.
    trace();
    ctx.strokeStyle = withAlpha(color, range(rng, 0.42, 0.8));
    ctx.lineWidth = range(rng, 0.7, 2.1);
    ctx.stroke();

    // Partículas suspendidas sobre la curva.
    const particles = Math.round(8 + complexity * 0.12);
    for (let particle = 0; particle < particles; particle += 1) {
      const t = rng() * TAU;
      const rawX = Math.sin(a * t + delta);
      const rawY = Math.sin(b * t + phase);
      const x =
        centerX +
        (rawX * Math.cos(rotation) - rawY * Math.sin(rotation)) * radiusX;
      const y =
        centerY +
        (rawX * Math.sin(rotation) + rawY * Math.cos(rotation)) * radiusY;
      ctx.fillStyle = withAlpha('#ffffff', range(rng, 0.35, 0.9));
      ctx.beginPath();
      ctx.arc(x, y, range(rng, 0.8, 2.6), 0, TAU);
      ctx.fill();
    }
  }

  // Núcleo de luz.
  const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 220);
  core.addColorStop(0, withAlpha('#ffffff', 0.22));
  core.addColorStop(0.18, withAlpha(palette.colors[0], 0.16));
  core.addColorStop(1, withAlpha(palette.colors[0], 0));
  ctx.fillStyle = core;
  ctx.fillRect(centerX - 220, centerY - 220, 440, 440);

  // Aros de referencia tenues.
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = withAlpha(palette.colors[1], 0.1);
  ctx.setLineDash([2, 14]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, 390, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 03 · Bauhaus Grid                                                   */
/* ------------------------------------------------------------------ */

function drawBauhausMotif(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  background: string,
  rng: Rng,
): void {
  const motif = Math.floor(rng() * 7);
  const inner = size * 0.72;
  const radius = inner / 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((Math.floor(rng() * 4) * Math.PI) / 2);
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineWidth = Math.max(3, size * range(rng, 0.08, 0.16));
  ctx.lineCap = 'butt';

  switch (motif) {
    case 0: {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.arc(0, 0, radius * range(rng, 0.24, 0.42), 0, TAU);
      ctx.fill();
      break;
    }
    case 1: {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 2: {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.92, 0, Math.PI / 2);
      ctx.stroke();
      break;
    }
    case 3: {
      ctx.beginPath();
      ctx.moveTo(-radius, radius);
      ctx.lineTo(radius, radius);
      ctx.lineTo(radius, -radius);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 4: {
      const stripes = 4 + Math.floor(rng() * 3);
      const stripeWidth = inner / stripes;
      for (let stripe = 0; stripe < stripes; stripe += 1) {
        if (stripe % 2 === 0) {
          ctx.fillRect(-radius + stripe * stripeWidth, -radius, stripeWidth, inner);
        }
      }
      break;
    }
    case 5: {
      ctx.fillRect(-radius * 0.8, -radius * 0.8, inner * 0.8, inner * 0.8);
      ctx.fillStyle = background;
      ctx.fillRect(-radius * 0.2, -radius * 0.2, inner * 0.4, inner * 0.4);
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.9, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.42, 0, TAU);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawBauhaus(
  ctx: CanvasRenderingContext2D,
  palette: PaletteDefinition,
  rng: Rng,
  complexity: number,
): void {
  ctx.save();
  const columns = 3 + Math.floor(complexity / 26);
  const margin = range(rng, 66, 104);
  const cell = (BASE - margin * 2) / columns;

  // Composición de fondo: un círculo desplazado y un bloque de color.
  ctx.fillStyle = withAlpha(colorAt(palette, Math.floor(rng() * 3) + 1), 0.16);
  ctx.beginPath();
  ctx.arc(
    range(rng, 280, 720),
    range(rng, 280, 720),
    range(rng, 230, 370),
    0,
    TAU,
  );
  ctx.fill();

  ctx.fillStyle = withAlpha(colorAt(palette, Math.floor(rng() * 4)), 0.08);
  ctx.fillRect(range(rng, 0, 320), range(rng, 0, 720), range(rng, 180, 420), cell * columns);

  const background = palette.backgroundAlt;
  for (let row = 0; row < columns; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = margin + column * cell;
      const y = margin + row * cell;
      const color = colorAt(palette, row + column + Math.floor(rng() * 2));
      const roll = rng();

      if (roll < 0.16) {
        ctx.fillStyle = withAlpha(color, range(rng, 0.75, 0.98));
        ctx.fillRect(x, y, cell, cell);
        continue;
      }

      if (roll < 0.3) {
        ctx.strokeStyle = withAlpha(color, 0.22);
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }

      const inset = cell * range(rng, 0.08, 0.16);
      drawBauhausMotif(
        ctx,
        x + cell / 2,
        y + cell / 2,
        cell - inset * 2,
        withAlpha(color, range(rng, 0.72, 0.98)),
        background,
        rng,
      );

      if (rng() < 0.2) {
        ctx.fillStyle = withAlpha('#ffffff', 0.55);
        ctx.beginPath();
        ctx.arc(x + cell * 0.2, y + cell * 0.2, cell * 0.025, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Barras transversales que rompen la retícula.
  const bars = 1 + Math.floor(rng() * 2);
  for (let bar = 0; bar < bars; bar += 1) {
    ctx.fillStyle = withAlpha(colorAt(palette, bar + 2), range(rng, 0.5, 0.85));
    const horizontal = rng() > 0.5;
    if (horizontal) {
      ctx.fillRect(margin * 0.4, range(rng, 120, 840), BASE - margin * 0.8, range(rng, 4, 11));
    } else {
      ctx.fillRect(range(rng, 120, 840), margin * 0.4, range(rng, 4, 11), BASE - margin * 0.8);
    }
  }

  // Puntos de registro tipográficos.
  ctx.fillStyle = withAlpha(palette.colors[4], 0.5);
  for (let dot = 0; dot < 6; dot += 1) {
    ctx.beginPath();
    ctx.arc(range(rng, margin * 0.45, BASE - margin * 0.45), range(rng, margin * 0.45, BASE - margin * 0.45), range(rng, 1.5, 3.4), 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 04 · Nebulosa Espiral                                               */
/* ------------------------------------------------------------------ */

function drawNebula(
  ctx: CanvasRenderingContext2D,
  palette: PaletteDefinition,
  rng: Rng,
  complexity: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const centerX = range(rng, 455, 545);
  const centerY = range(rng, 455, 545);
  const arms = 2 + Math.floor(rng() * 3);
  const rotation = range(rng, 0, TAU);
  const maxRadius = range(rng, 355, 430);
  const twist = range(rng, 3.2, 5.6);

  // Nubes de polvo de gran escala.
  for (let cloud = 0; cloud < 4; cloud += 1) {
    drawGlow(
      ctx,
      centerX + range(rng, -150, 150),
      centerY + range(rng, -150, 150),
      range(rng, 220, 420),
      colorAt(palette, cloud),
      range(rng, 0.04, 0.1),
    );
  }

  // Campo estelar lejano.
  const stars = Math.round(80 + complexity * 1.4);
  for (let star = 0; star < stars; star += 1) {
    ctx.fillStyle = withAlpha(colorAt(palette, star), range(rng, 0.12, 0.62));
    ctx.beginPath();
    ctx.arc(rng() * BASE, rng() * BASE, range(rng, 0.4, 1.5), 0, TAU);
    ctx.fill();
  }

  // Partículas de la galaxia.
  const particles = Math.round(1300 + complexity * 58);
  for (let index = 0; index < particles; index += 1) {
    const distance = Math.pow(rng(), 0.62);
    const radius = 24 + distance * maxRadius;
    const arm = index % arms;
    const angle =
      rotation +
      (arm / arms) * TAU +
      distance * twist +
      gaussian(rng) * (0.16 + (1 - distance) * 0.5);
    const jitter = gaussian(rng) * (10 + distance * 52);
    const x = centerX + Math.cos(angle) * radius + jitter;
    const y = centerY + Math.sin(angle) * radius * 0.82 + jitter * 0.7;
    const color = colorAt(palette, arm);
    const alpha = 0.12 + (1 - distance) * 0.55 + rng() * 0.18;
    const size = 0.7 + rng() * (1.1 + (1 - distance) * 1.9);

    ctx.fillStyle = withAlpha(color, Math.min(0.95, alpha));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }

  // Estrellas jóvenes con destellos.
  for (let star = 0; star < 16; star += 1) {
    const angle = range(rng, 0, TAU);
    const radius = range(rng, 70, 330);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.82;
    const color = colorAt(palette, star);
    const size = range(rng, 1.4, 3.2);
    ctx.fillStyle = withAlpha('#ffffff', 0.85);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.45);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - size * 5, y);
    ctx.lineTo(x + size * 5, y);
    ctx.moveTo(x, y - size * 5);
    ctx.lineTo(x, y + size * 5);
    ctx.stroke();
  }

  // Núcleo galáctico.
  drawGlow(ctx, centerX, centerY, 180, palette.colors[0], 0.45);
  const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 62);
  core.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  core.addColorStop(0.2, withAlpha(palette.colors[0], 0.9));
  core.addColorStop(0.7, withAlpha(palette.colors[1], 0.24));
  core.addColorStop(1, withAlpha(palette.colors[1], 0));
  ctx.fillStyle = core;
  ctx.fillRect(centerX - 62, centerY - 62, 124, 124);

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Acabado editorial: grano, viñeta y marco                             */
/* ------------------------------------------------------------------ */

function drawGrain(ctx: CanvasRenderingContext2D, rng: Rng, intensity: number): void {
  const noise = document.createElement('canvas');
  noise.width = 180;
  noise.height = 180;
  const noiseCtx = noise.getContext('2d');
  if (!noiseCtx) {
    return;
  }

  const image = noiseCtx.createImageData(noise.width, noise.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.floor(rng() * 255);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = Math.floor(rng() * 26);
  }
  noiseCtx.putImageData(image, 0, 0);

  const pattern = ctx.createPattern(noise, 'repeat');
  if (!pattern) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, BASE, BASE);
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, strength: number): void {
  const vignette = ctx.createRadialGradient(500, 500, 240, 500, 500, 740);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.72, `rgba(0, 0, 0, ${strength * 0.18})`);
  vignette.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, BASE, BASE);
}

/** Renderiza una obra determinista en cualquier canvas, a la resolución indicada. */
export function renderArtwork(canvas: HTMLCanvasElement, spec: ArtworkSpec, pixelSize = 1000): void {
  const size = Math.max(320, Math.min(4096, Math.round(pixelSize)));
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const rng = createRng(spec.seed);
  const palette = getPalette(spec.palette);
  const complexity = Math.max(10, Math.min(100, Math.round(spec.complexity)));

  ctx.save();
  ctx.setTransform(size / BASE, 0, 0, size / BASE, 0, 0);

  paintBackdrop(ctx, palette);

  switch (spec.algorithm) {
    case 'Ondas de Lissajous':
      drawLissajous(ctx, palette, rng, complexity);
      break;
    case 'Bauhaus Grid':
      drawBauhaus(ctx, palette, rng, complexity);
      break;
    case 'Nebulosa Espiral':
      drawNebula(ctx, palette, rng, complexity);
      break;
    case 'Constelación Geométrica':
    default:
      drawConstellation(ctx, palette, rng, complexity);
      break;
  }

  drawGrain(ctx, rng, spec.algorithm === 'Bauhaus Grid' ? 0.7 : 0.45);
  drawVignette(ctx, spec.algorithm === 'Bauhaus Grid' ? 0.32 : 0.5);

  // Marco interior sutil, como un passe-partout de museo.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, BASE - 24, BASE - 24);

  ctx.restore();
}

/** Genera una semilla criptográficamente aleatoria de 32 bits. */
export function createRandomSeed(): number {
  const buffer = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buffer);
    return buffer[0] ?? 1;
  }
  return Math.floor(Math.random() * 0xffff_ffff) || 1;
}

export function normalizeSeed(seed: number): number {
  const normalized = Math.trunc(Math.abs(seed)) >>> 0;
  return normalized === 0 ? 1 : normalized;
}

export function seedToHex(seed: number): string {
  return `0x${normalizeSeed(seed).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function normalizePalette(palette: string): Palette {
  return PALETTE_KEYS.includes(palette as Palette) ? (palette as Palette) : 'Cyberpunk';
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Exporta la pieza a PNG en alta resolución (2000 × 2000). */
export function downloadArtworkPng(spec: ArtworkSpec, title: string, seed: number): void {
  const canvas = document.createElement('canvas');
  renderArtwork(canvas, spec, 2000);
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `synapse-${slugify(title) || 'obra'}-${seedToHex(seed).slice(2)}.png`;
  link.href = dataUrl;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
