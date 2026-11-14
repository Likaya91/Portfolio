async function playPortraitSequence() {
  const portrait = document.querySelector('.portrait-image');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!portrait || reducedMotion.matches) return;

  const frameDelay = 800;
  const frames = [2, 3, 4, 5].map((number) => {
    const frame = new Image();
    frame.src = `assets/home/home-portrait-${number}.webp`;
    return frame.decode().then(() => frame.src, () => null);
  });

  await portrait.decode().catch(() => {});

  for (const frame of frames) {
    const [source] = await Promise.all([
      frame,
      new Promise((resolve) => window.setTimeout(resolve, frameDelay)),
    ]);

    if (reducedMotion.matches) return;
    if (source) portrait.src = source;
  }
}

playPortraitSequence();
