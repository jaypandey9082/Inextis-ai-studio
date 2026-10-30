// Draws the NOVA key visual at any size. Layout is chosen from the aspect ratio,
// and the background is generated, so it extends to any shape without stretching.

export type KVOptions = {
  headline: string;
  sub: string;
  sponsor: string;
  accent: string;
  fontDisplay: string;
  fontBody: string;
};

type Ctx = CanvasRenderingContext2D;

function background(ctx: Ctx, W: number, H: number, accent: string) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0d0424");
  g.addColorStop(0.45, "#241079");
  g.addColorStop(1, "#0f3cc0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const unit = Math.min(W, H);
  const glow = ctx.createRadialGradient(W * 0.82, H * 0.2, 0, W * 0.82, H * 0.2, Math.max(W, H) * 0.55);
  glow.addColorStop(0, accent + "88");
  glow.addColorStop(1, accent + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // flowing lines: wavelength tied to height so the pattern keeps its look on any width
  ctx.lineWidth = Math.max(1, unit * 0.004);
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = `rgba(160, 190, 255, ${0.05 + i * 0.012})`;
    ctx.beginPath();
    const wl = H * 1.7;
    for (let x = 0; x <= W; x += Math.max(2, W / 600)) {
      const y = H * (0.55 + i * 0.045) + Math.sin(x / wl * Math.PI * 2 + i * 0.5) * H * 0.12;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // LED dot texture
  const step = Math.max(4, unit * 0.028);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) ctx.fillRect(x, y, step * 0.12, step * 0.12);
}

function logo(ctx: Ctx, x: number, y: number, h: number, o: KVOptions, align: "left" | "center" = "left") {
  ctx.save();
  ctx.font = `500 ${h * 0.62}px ${o.fontDisplay}`;
  const nova = "NOVA";
  ctx.letterSpacing = `${h * 0.08}px`;
  const wNova = ctx.measureText(nova).width;
  ctx.font = `300 ${h * 0.62}px ${o.fontDisplay}`;
  const wEnergy = ctx.measureText(" ENERGY").width;
  const ring = h * 0.78;
  const total = ring + h * 0.28 + wNova + wEnergy;
  const x0 = align === "center" ? x - total / 2 : x;
  const cy = y + h / 2;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = h * 0.09;
  ctx.beginPath();
  ctx.arc(x0 + ring / 2, cy, ring / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = o.accent;
  ctx.beginPath();
  ctx.arc(x0 + ring * 0.78, cy - ring * 0.28, h * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${h * 0.62}px ${o.fontDisplay}`;
  ctx.fillText(nova, x0 + ring + h * 0.28, cy + h * 0.03);
  ctx.font = `300 ${h * 0.62}px ${o.fontDisplay}`;
  ctx.fillText(" ENERGY", x0 + ring + h * 0.28 + wNova, cy + h * 0.03);
  ctx.restore();
  return total;
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Shrinks the font until the text fits in maxLines.
function fitText(ctx: Ctx, text: string, font: (px: number) => string, start: number, maxW: number, maxLines: number) {
  let size = start;
  for (let i = 0; i < 30; i++) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size, lines };
    size *= 0.92;
  }
  ctx.font = font(size);
  return { size, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
}

function sponsorWidth(ctx: Ctx, h: number, o: KVOptions) {
  ctx.save();
  ctx.font = `400 ${h * 0.36}px ${o.fontBody}`;
  const wl = ctx.measureText("POWERED BY  ").width;
  ctx.font = `600 ${h * 0.5}px ${o.fontDisplay}`;
  ctx.letterSpacing = `${h * 0.06}px`;
  const wn = ctx.measureText(o.sponsor).width;
  ctx.restore();
  return wl + wn;
}

function sponsorTag(ctx: Ctx, xRight: number, cy: number, h: number, o: KVOptions, align: "right" | "center" = "right") {
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = `400 ${h * 0.36}px ${o.fontBody}`;
  const label = "POWERED BY  ";
  const wl = ctx.measureText(label).width;
  ctx.font = `600 ${h * 0.5}px ${o.fontDisplay}`;
  ctx.letterSpacing = `${h * 0.06}px`;
  const wn = ctx.measureText(o.sponsor).width;
  const x0 = align === "right" ? xRight - wl - wn : xRight - (wl + wn) / 2;
  ctx.letterSpacing = "0px";
  ctx.font = `400 ${h * 0.36}px ${o.fontBody}`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(label, x0, cy);
  ctx.font = `600 ${h * 0.5}px ${o.fontDisplay}`;
  ctx.letterSpacing = `${h * 0.06}px`;
  ctx.fillStyle = "#fff";
  ctx.fillText(o.sponsor, x0 + wl, cy);
  ctx.restore();
}

export function drawKeyVisual(ctx: Ctx, W: number, H: number, o: KVOptions) {
  ctx.clearRect(0, 0, W, H);
  background(ctx, W, H, o.accent);
  const a = W / H;
  ctx.textBaseline = "alphabetic";
  const display = (w: number) => (px: number) => `${w} ${px}px ${o.fontDisplay}`;

  if (a >= 4) {
    // Ultra-wide: one row, repeated on very long ribbons so it reads from every side
    const segs = a >= 10 ? 2 : 1;
    const sw = W / segs;
    const sa = sw / H;
    const logoH = sa < 8 ? H * 0.26 : H * 0.36;
    const sponsorH = sa < 8 ? H * 0.2 : H * 0.28;
    for (let s = 0; s < segs; s++) {
      const x = s * sw;
      const pad = H * 0.2;
      const lw = logo(ctx, x + pad, H / 2 - logoH / 2, logoH, o);
      const divX = x + pad + lw + H * 0.3;
      ctx.fillStyle = o.accent;
      ctx.fillRect(divX, H * 0.22, Math.max(2, H * 0.025), H * 0.56);
      const tx = divX + H * 0.3;
      const avail = sw - (tx - x) - sponsorWidth(ctx, sponsorH, o) - pad * 2;
      const t = fitText(ctx, o.headline, display(300), H * 0.3, avail, sa < 8 ? 2 : 1);
      const lh = t.size * 1.1;
      const showSub = t.lines.length === 1;
      const block = t.lines.length * lh + (showSub ? H * 0.2 : 0);
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "top";
      t.lines.forEach((l, i) => ctx.fillText(l, tx, H / 2 - block / 2 + i * lh));
      if (showSub) {
        ctx.font = `400 ${Math.min(t.size * 0.48, H * 0.13)}px ${o.fontBody}`;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(o.sub, tx, H / 2 - block / 2 + lh + H * 0.04);
      }
      sponsorTag(ctx, x + sw - pad, H * 0.5, sponsorH, o);
    }
    return;
  }

  if (a >= 1.3) {
    const pad = H * 0.09;
    logo(ctx, pad, pad, H * 0.11, o);
    const maxW = W * 0.6;
    const t = fitText(ctx, o.headline, display(300), H * 0.14, maxW, 2);
    const lh = t.size * 1.12;
    const top = H * 0.5 - (t.lines.length * lh) / 2;
    ctx.fillStyle = o.accent;
    ctx.fillRect(pad, top - lh * 0.15, Math.max(3, H * 0.012), t.lines.length * lh + lh * 0.1);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    t.lines.forEach((l, i) => ctx.fillText(l, pad + H * 0.05, top + i * lh));
    ctx.font = `400 ${t.size * 0.38}px ${o.fontBody}`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(o.sub, pad + H * 0.05, top + t.lines.length * lh + t.size * 0.25);
    ctx.fillStyle = "rgba(5,3,20,0.45)";
    ctx.fillRect(0, H * 0.88, W, H * 0.12);
    sponsorTag(ctx, W - pad, H * 0.94, H * 0.075, o);
    return;
  }

  // Centred (square-ish) and tall stack share the vertical layout
  const tall = a < 0.8;
  const pad = W * 0.08;
  logo(ctx, W / 2, tall ? H * 0.07 : H * 0.09, tall ? W * 0.11 : H * 0.1, o, "center");
  const t = fitText(ctx, o.headline, display(300), tall ? W * 0.12 : W * 0.1, W - pad * 2, tall ? 4 : 3);
  const lh = t.size * 1.12;
  const mid = tall ? H * 0.45 : H * 0.48;
  const top = mid - (t.lines.length * lh) / 2;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  t.lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));
  ctx.fillStyle = o.accent;
  ctx.fillRect(W / 2 - W * 0.06, top + t.lines.length * lh + t.size * 0.2, W * 0.12, Math.max(3, W * 0.008));
  ctx.font = `400 ${t.size * 0.36}px ${o.fontBody}`;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(o.sub, W / 2, top + t.lines.length * lh + t.size * 0.5);
  ctx.textAlign = "left";
  const barH = tall ? H * 0.08 : H * 0.12;
  ctx.fillStyle = "rgba(5,3,20,0.45)";
  ctx.fillRect(0, H - barH, W, barH);
  sponsorTag(ctx, W / 2, H - barH / 2, barH * 0.6, o, "center");
}

// What a plain resize does: the 16:9 master squeezed into the screen.
export function drawStretched(ctx: Ctx, W: number, H: number, master: HTMLCanvasElement) {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(master, 0, 0, W, H);
}
