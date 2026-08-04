import { describe, it, expect } from 'vitest';
import { computeDynamicGrid } from './grid-layout';

describe('computeDynamicGrid', () => {
  const containerW = 1920;
  const containerH = 1080;
  const paddingX = 16;
  const paddingY = 16;
  const gap = 8;

  it('should wrap 5 participants into multiple rows rather than a single very skinny row', () => {
    const result = computeDynamicGrid(5, containerW, containerH, paddingX, paddingY, gap);
    
    // We expect the layout algorithm to prioritize a healthy aspect ratio over filling 100% of the screen area.
    // For 5 participants on a 16:9 monitor, 3 columns x 2 rows is much better than 5 columns x 1 row.
    expect(result.cols).toBeLessThan(5);
    expect(result.rows).toBeGreaterThan(1);
    
    // specifically, we expect 3 cols and 2 rows
    expect(result.cols).toBe(3);
    expect(result.rows).toBe(2);
  });

  it('should handle 1 participant as 1 column and 1 row', () => {
    const result = computeDynamicGrid(1, containerW, containerH, paddingX, paddingY, gap);
    expect(result.cols).toBe(1);
    expect(result.rows).toBe(1);
  });

  it('should handle 2 participants as 2 columns and 1 row on wide screens', () => {
    const result = computeDynamicGrid(2, containerW, containerH, paddingX, paddingY, gap);
    expect(result.cols).toBe(2);
    expect(result.rows).toBe(1);
  });

  it('should handle 12 participants in a 4x3 or similar grid', () => {
    const result = computeDynamicGrid(12, containerW, containerH, paddingX, paddingY, gap);
    // 12 on 1920x1080 should ideally be 4 cols x 3 rows
    expect(result.cols).toBe(4);
    expect(result.rows).toBe(3);
  });
});
