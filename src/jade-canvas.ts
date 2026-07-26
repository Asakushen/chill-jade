type Orb = { x: number; y: number; radius: number; phase: number; speed: number; orbit: number; hue: number };

export function initJadeCanvas(): void {
  const canvasElement = document.querySelector<HTMLCanvasElement>("#jade-canvas");
  const stageElement = document.querySelector<HTMLElement>("#jade-stage");
  if (!canvasElement || !stageElement) return;
  const drawingContext = canvasElement.getContext("2d", { alpha: true });
  if (!drawingContext) return;
  const canvas: HTMLCanvasElement = canvasElement;
  const stage: HTMLElement = stageElement;
  const context: CanvasRenderingContext2D = drawingContext;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(pointer: coarse)");
  const orbs: Orb[] = Array.from({ length: coarse.matches ? 7 : 10 }, (_, index) => ({
    x: 0, y: 0,
    radius: 0.19 + (index % 4) * 0.023,
    phase: (Math.PI * 2 * index) / 10,
    speed: 0.11 + (index % 5) * 0.018,
    orbit: 0.065 + (index % 3) * 0.018,
    hue: index % 4,
  }));
  let width = 1, height = 1, dpr = 1, frame = 0, visible = true;
  let pointerX = .5, pointerY = .5, targetX = .5, targetY = .5;

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, coarse.matches ? 1.35 : 1.75);
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(time: number): void {
    if (!visible) { frame = requestAnimationFrame(draw); return; }
    context.clearRect(0, 0, width, height);
    pointerX += (targetX - pointerX) * .035; pointerY += (targetY - pointerY) * .035;
    const size = Math.min(width, height), cx = width * .5, cy = height * .5;
    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = `blur(${Math.max(17, size * .052)}px)`;

    const still = reduced.matches ? 0 : time * .001;
    orbs.forEach((orb, index) => {
      const t = still * orb.speed + orb.phase;
      const wobble = Math.sin(still * .31 + index * 1.7) * .025;
      orb.x = cx + Math.cos(t * 1.13) * size * (orb.orbit + wobble) + (pointerX - .5) * size * .12 * (index % 2 ? 1 : -1);
      orb.y = cy + Math.sin(t * .87) * size * (orb.orbit + wobble) + (pointerY - .5) * size * .1 * (index % 3 ? 1 : -1);
      const radius = size * orb.radius * (1 + Math.sin(t * 1.8 + index) * .09);
      const gradient = context.createRadialGradient(orb.x - radius * .22, orb.y - radius * .27, radius * .04, orb.x, orb.y, radius);
      const palettes = [
        ["rgba(255,223,154,.82)", "rgba(196,140,46,.32)"],
        ["rgba(255,195,128,.7)", "rgba(158,92,40,.3)"],
        ["rgba(244,206,255,.6)", "rgba(126,68,168,.28)"],
        ["rgba(255,210,170,.64)", "rgba(150,82,52,.26)"],
      ];
      gradient.addColorStop(0, palettes[orb.hue][0]); gradient.addColorStop(.48, palettes[orb.hue][1]); gradient.addColorStop(1, "rgba(20,14,30,0)");
      context.fillStyle = gradient; context.beginPath(); context.arc(orb.x, orb.y, radius, 0, Math.PI * 2); context.fill();
    });
    context.restore();

    const lens = context.createRadialGradient(cx - size * .12, cy - size * .14, 0, cx, cy, size * .38);
    lens.addColorStop(0, "rgba(231,255,241,.16)"); lens.addColorStop(.32, "rgba(102,235,181,.06)"); lens.addColorStop(.72, "rgba(21,95,72,.035)"); lens.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = lens; context.beginPath(); context.arc(cx, cy, size * .38, 0, Math.PI * 2); context.fill();
    frame = requestAnimationFrame(draw);
  }

  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const rect = stage.getBoundingClientRect(); targetX = (event.clientX - rect.left) / rect.width; targetY = (event.clientY - rect.top) / rect.height;
  });
  stage.addEventListener("pointerleave", () => { targetX = .5; targetY = .5; });
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  observer.observe(stage);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); resize();
  frame = requestAnimationFrame(draw);
  window.addEventListener("pagehide", () => { cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect(); }, { once: true });
}
