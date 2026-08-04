import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../frontend/lib/api-client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  describe('fetchApi internal helper', () => {
    it('handles successful JSON response', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValueOnce(JSON.stringify({ user: mockUser }))
      });

      const result = await apiClient.auth.getMe();
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
        headers: { 'Content-Type': 'application/json' }
      }));
      expect(result).toEqual({ user: mockUser });
    });

    it('handles successful empty response (e.g. 204 No Content)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValueOnce('')
      });

      const result = await apiClient.auth.logout();
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
        method: 'POST'
      }));
      expect(result).toBeNull();
    });

    it('throws error with JSON error message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValueOnce({ message: 'Invalid credentials' }),
        statusText: 'Bad Request'
      });

      await expect(apiClient.auth.login({ email: 'test@example.com', password: 'bad' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('throws error with JSON error field if message is not present', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValueOnce({ error: 'Server error occurred' }),
        statusText: 'Internal Server Error'
      });

      await expect(apiClient.rooms.getAll())
        .rejects.toThrow('Server error occurred');
    });

    it('throws error with statusText if JSON parsing fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
        statusText: 'Not Found'
      });

      await expect(apiClient.rooms.getBySlug('non-existent'))
        .rejects.toThrow('Not Found');
    });
  });

  describe('Endpoints Payload serialization', () => {
    it('serializes POST body correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValueOnce('{}')
      });

      const payload = { name: 'New Room', mode: 'meeting' as const };
      await apiClient.rooms.create(payload);

      expect(global.fetch).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload)
      }));
    });

    it('serializes PATCH body correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValueOnce('{}')
      });

      const payload = { maxParticipants: 50 };
      await apiClient.rooms.update('room-123', payload);

      expect(global.fetch).toHaveBeenCalledWith('/api/rooms/room-123', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(payload)
      }));
    });

    it('sends DELETE request correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValueOnce('')
      });

      await apiClient.rooms.delete('room-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/rooms/room-123', expect.objectContaining({
        method: 'DELETE'
      }));
    });
  });
  
  describe('Other endpoints', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('{}')
      });
    });

    it('auth endpoints', async () => {
      await apiClient.auth.signup({ email: 'a@a.com', password: 'b', name: 'c' });
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.anything());
    });

    it('dashboard endpoints', async () => {
      await apiClient.dashboard.getStats();
      expect(global.fetch).toHaveBeenCalledWith('/api/dashboard', expect.anything());
    });

    it('scheduling endpoints', async () => {
      await apiClient.scheduling.getUpcoming();
      expect(global.fetch).toHaveBeenCalledWith('/api/scheduling', expect.anything());
      await apiClient.scheduling.schedule({ roomId: '1', title: 'A', startTime: 'now', durationMin: 30 });
      expect(global.fetch).toHaveBeenCalledWith('/api/scheduling', expect.objectContaining({ method: 'POST' }));
    });

    it('telephony endpoints', async () => {
      await apiClient.telephony.getDialInNumbers();
      expect(global.fetch).toHaveBeenCalledWith('/api/telephony/numbers', expect.anything());
    });

    it('ai endpoints', async () => {
      await apiClient.ai.getSummary('room1');
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/summary/room1', expect.anything());
      await apiClient.ai.getTranscription('room1');
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/transcription/room1', expect.anything());
    });

    it('streaming endpoints', async () => {
      await apiClient.streaming.startStream({ roomId: '1', rtmpUrls: [] });
      expect(global.fetch).toHaveBeenCalledWith('/api/streaming/start', expect.objectContaining({ method: 'POST' }));
      await apiClient.streaming.stopStream('stream1');
      expect(global.fetch).toHaveBeenCalledWith('/api/streaming/stream1/stop', expect.objectContaining({ method: 'POST' }));
      await apiClient.streaming.getStreams('roomSlug');
      expect(global.fetch).toHaveBeenCalledWith('/api/streaming/roomSlug', expect.anything());
    });

    it('recordings endpoints', async () => {
      await apiClient.recordings.getAll();
      expect(global.fetch).toHaveBeenCalledWith('/api/recordings', expect.anything());
      await apiClient.recordings.getDetails('rec1');
      expect(global.fetch).toHaveBeenCalledWith('/api/recordings/rec1/details', expect.anything());
      await apiClient.recordings.startRecording({ title: 'A', roomSlug: 'room1' });
      expect(global.fetch).toHaveBeenCalledWith('/api/recordings/start', expect.objectContaining({ method: 'POST' }));
      await apiClient.recordings.stopRecording('rec1');
      expect(global.fetch).toHaveBeenCalledWith('/api/recordings/rec1/stop', expect.objectContaining({ method: 'POST' }));
    });
  });
});
