export interface GridSolution {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
}

export const computeDynamicGrid = (c: number, w: number, h: number, paddingX: number, paddingY: number, gap: number): GridSolution => {
  const availW = Math.max(0, w - paddingX * 2);
  const availH = Math.max(0, h - paddingY * 2);

  let best: GridSolution = { cols: 1, rows: c, tileW: 0, tileH: 0 };
  let bestScore = -Infinity;

  const maxCols = Math.min(c, 6);

  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(c / cols);
    const tileW = (availW - gap * (cols - 1)) / cols;
    const tileH = (availH - gap * (rows - 1)) / rows;

    if (tileW < 80 || tileH < 60) continue;

    const area = tileW * tileH;
    const aspect = tileW / tileH;
    const targetAspect = 16 / 9;
    
    // Use a stronger penalty for bad aspect ratios
    const aspectPenalty = Math.abs(Math.log(aspect / targetAspect));
    const score = area / (1 + aspectPenalty * 2);

    if (score > bestScore) {
      bestScore = score;
      best = { cols, rows, tileW, tileH };
    }
  }

  return best;
};
