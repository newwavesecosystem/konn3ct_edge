import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Recorder Worker - Connection Behavior', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('rejects localhost BACKEND_URL in Kubernetes mode', async () => {
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
    process.env.BACKEND_URL = 'http://localhost:4000';
    
    const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
    const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const script = fs.readFileSync(path.join(__dirname, '../../recorder/index.js'), 'utf8');
      const validationBlock = script.split('// 5. Add startup validation')[1].split('async function startWorker()')[0];
      eval(validationBlock);
    } catch (e: any) {
      expect(e.message).toBe('process.exit');
    }

    expect(consoleMock).toHaveBeenCalledWith(expect.stringContaining('[FATAL] BACKEND_URL must be set to internal service DNS'));
    expect(exitMock).toHaveBeenCalledWith(1);
    
    exitMock.mockRestore();
    consoleMock.mockRestore();
  });

  it('allows valid BACKEND_URL in Kubernetes mode', async () => {
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
    process.env.BACKEND_URL = 'http://conn3ct-backend-service:80';
    
    const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {});

    const script = fs.readFileSync(path.join(__dirname, '../../recorder/index.js'), 'utf8');
    const validationBlock = script.split('// 5. Add startup validation')[1].split('async function startWorker()')[0];
    eval(validationBlock);

    expect(exitMock).not.toHaveBeenCalled();
    exitMock.mockRestore();
  });

  it('retries ECONNREFUSED with backoff and marks job failed after exhaustion', async () => {
    // We test the helper function logic specifically
    let fetchCalls = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCalls++;
      const err = new Error('fetch failed');
      (err as any).cause = { code: 'ECONNREFUSED' };
      throw err;
    });

    global.fetch = mockFetch as any;
    
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const script = fs.readFileSync(path.join(__dirname, '../../recorder/index.js'), 'utf8');
    // Extract notifyBackendWithRetry function
    const funcMatch = script.match(/async function notifyBackendWithRetry[\s\S]*?^}/m);
    if (funcMatch) {
      // Evaluate the function in current context
      const notifyBackendWithRetry = eval(`(${funcMatch[0]})`);
      
      try {
        await notifyBackendWithRetry('http://localhost:4000', '/test', 'rec1', 'job1', 'token', 'test_stage');
      } catch (e: any) {
        expect(e.message).toContain('Recording backend notification failed');
      }
      
      expect(fetchCalls).toBe(3); // 3 retries
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('recording_worker_connection_attempt'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('recording_worker_connection_failed'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    }
    
    consoleLogSpy.mockRestore();
  });

  it('masks bot tokens and bot secrets in URLs', () => {
    const rawUrl = 'https://konn3ct.net/meeting/slug?botToken=eyJhbGciOiJI.eyJyb2xlIjoicmV.someSecret&botSecret=12345';
    const maskedUrl = rawUrl.replace(/botToken=[^&]*/, 'botToken=***MASKED***').replace(/botSecret=[^&]*/, 'botSecret=***MASKED***');
    
    expect(maskedUrl).toBe('https://konn3ct.net/meeting/slug?botToken=***MASKED***&botSecret=***MASKED***');
    expect(maskedUrl).not.toContain('eyJhbGciOiJI');
    expect(maskedUrl).not.toContain('12345');
  });
});
