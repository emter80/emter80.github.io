/* Triangle mesh background, emerald / gold palette.
   The reaction is deliberately gentle: points are nudged away from the pointer by a few
   pixels, nearby triangles brighten faintly, and the whole mesh drifts a little with the
   pointer position. When nothing moves the animation loop stops completely. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('tri');
  if (!cv) return;
  const ctx = cv.getContext('2d');

  const SIZE = 96;           // edge length of one triangle (px)
  const RADIUS = 170;        // pointer influence radius (px)
  const PUSH = 0.6;         // how strongly points are nudged away (low = gentle)
  const DRIFT = 0.006;       // parallax: how far the whole mesh follows the pointer
  const GLOW = 0.12;         // peak fill opacity of triangles near the pointer

  // highlighted edges stay emerald; no colour change when the pointer is close
  const LIT = [52, 211, 153];

  const mouse = { x: -9999, y: -9999 };
  let W, H, dpr, cols, rows, pts = [], tris = [];
  let drift = { x: 0, y: 0 }, raf = 0;

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rowH = SIZE * 0.866;
    cols = Math.ceil(W / SIZE) + 3;
    rows = Math.ceil(H / rowH) + 3;

    pts = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = (c - 1) * SIZE + (r % 2 ? SIZE / 2 : 0) + (Math.random() - 0.5) * SIZE * 0.18;
        const by = (r - 1) * rowH + (Math.random() - 0.5) * SIZE * 0.18;
        pts.push({ bx, by, x: bx, y: by, vx: 0, vy: 0 });
      }
    }

    tris = [];
    const at = (r, c) => r * cols + c;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const quad = r % 2
          ? [[at(r, c), at(r + 1, c), at(r + 1, c + 1)], [at(r, c), at(r, c + 1), at(r + 1, c + 1)]]
          : [[at(r, c), at(r, c + 1), at(r + 1, c)], [at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)]];
        quad.forEach((v) => tris.push({ v, glow: 0, shade: Math.random() }));
      }
    }
    wake();
  }

  function path(a, b, c) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    let moving = false;

    // gentle parallax of the whole mesh towards the pointer
    const tx = mouse.x > -9000 ? (mouse.x - W / 2) * -DRIFT : 0;
    const ty = mouse.y > -9000 ? (mouse.y - H / 2) * -DRIFT : 0;
    drift.x += (tx - drift.x) * 0.06; drift.y += (ty - drift.y) * 0.06;
    if (Math.abs(tx - drift.x) > 0.05 || Math.abs(ty - drift.y) > 0.05) moving = true;

    // spring physics: points are nudged away from the pointer and ease back
    for (const p of pts) {
      const dx = p.x + drift.x - mouse.x, dy = p.y + drift.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < RADIUS && d > 0.01) {
        const k = 1 - d / RADIUS;
        p.vx += (dx / d) * k * k * PUSH;
        p.vy += (dy / d) * k * k * PUSH;
      }
      p.vx += (p.bx - p.x) * 0.05; p.vy += (p.by - p.y) * 0.05;
      p.vx *= 0.85; p.vy *= 0.85;
      p.x += p.vx; p.y += p.vy;
      if (Math.abs(p.vx) > 0.01 || Math.abs(p.vy) > 0.01 || Math.abs(p.x - p.bx) > 0.05) moving = true;
    }

    ctx.save();
    ctx.translate(drift.x, drift.y);

    // resting mesh: faint facets + hairlines
    for (const t of tris) {
      const a = pts[t.v[0]], b = pts[t.v[1]], c = pts[t.v[2]];
      ctx.fillStyle = `rgba(110,231,183,${0.006 + t.shade * 0.018})`;
      path(a, b, c); ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(16,185,129,.15)';
    ctx.beginPath();
    for (const t of tris) {
      const a = pts[t.v[0]], b = pts[t.v[1]], c = pts[t.v[2]];
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
    }
    ctx.stroke();

    // triangles near the pointer brighten a little and fade out slowly
    for (const t of tris) {
      const a = pts[t.v[0]], b = pts[t.v[1]], c = pts[t.v[2]];
      const cx = (a.x + b.x + c.x) / 3 + drift.x, cy = (a.y + b.y + c.y) / 3 + drift.y;
      const hit = Math.max(0, 1 - Math.hypot(cx - mouse.x, cy - mouse.y) / (RADIUS * 1.1));
      t.glow = Math.max(t.glow * 0.95, hit * hit);
      if (t.glow < 0.02) continue;
      moving = true;
      const [r, g, bl] = LIT;
      path(a, b, c);
      ctx.fillStyle = `rgba(16,185,129,${t.glow * GLOW})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${bl},${0.12 + t.glow * 0.3})`;
      ctx.stroke();
    }
    ctx.restore();

    raf = moving ? requestAnimationFrame(frame) : 0;   // loop sleeps when everything is at rest
  }

  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  // phones: same static mesh, no pointer reaction. Mice and tablets keep the motion
  // (shortest screen side >= 600px tells a tablet from a phone, in either orientation).
  const isPhone = matchMedia('(hover: none)').matches && Math.min(screen.width, screen.height) < 600;
  const canHover = !isPhone;
  const touchOnly = matchMedia('(hover: none)').matches;

  build();
  // on touch devices the address bar showing/hiding fires resize; only rebuild when the width changes
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (!touchOnly || innerWidth !== lastW) { lastW = innerWidth; build(); }
  });
  if (!reduce && canHover) {
    addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; wake(); }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; wake(); });
  }
})();
