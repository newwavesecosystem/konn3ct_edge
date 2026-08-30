import dotenv from 'dotenv';
import path from 'path';
import '@testing-library/jest-dom';

// Load .env.test specifically for Vitest before Prisma initializes
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Verify it loaded correctly
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is missing in .env.test. Integration tests may fail. Check .env.test.example.');
} else {
  const dbUrl = process.env.DATABASE_URL.toLowerCase();
  
  if (dbUrl.includes('production') || dbUrl.includes('prod') || dbUrl.includes('staging')) {
    console.error('❌  DANGER: DATABASE_URL appears to be pointing to production or staging! Tests aborted.');
    process.exit(1);
  }

  if (!dbUrl.includes('test') && !dbUrl.includes('konn3ct_test')) {
    console.error('❌  DANGER: DATABASE_URL does not contain "test". Refusing to run integration tests against a potentially real database.');
    process.exit(1);
  }
}

// Global browser API polyfills for unit testing
const createLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    length: 0,
    key: () => null,
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = createLocalStorageMock();
}

if (typeof globalThis.HTMLCanvasElement !== 'undefined' && !globalThis.HTMLCanvasElement.prototype.captureStream) {
  globalThis.HTMLCanvasElement.prototype.captureStream = function() {
    return {
      getTracks: () => [{ stop: () => {} }],
      getVideoTracks: () => [{ stop: () => {} }],
    } as any;
  };
}

if (typeof globalThis.HTMLMediaElement !== 'undefined') {
  globalThis.HTMLMediaElement.prototype.play = function() {
    return Promise.resolve();
  };
  globalThis.HTMLMediaElement.prototype.pause = function() {};
}

if (typeof globalThis.MediaStream === 'undefined') {
  (globalThis as any).MediaStream = class MediaStream {
    private tracks: any[];
    constructor(tracks?: any[]) {
      this.tracks = tracks || [];
    }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter((t: any) => t.kind === 'video' || !t.kind); }
    getAudioTracks() { return this.tracks.filter((t: any) => t.kind === 'audio'); }
    addTrack(t: any) { this.tracks.push(t); }
    removeTrack(t: any) { this.tracks = this.tracks.filter((x: any) => x !== t); }
  };
}
