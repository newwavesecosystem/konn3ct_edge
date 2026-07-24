import React from 'react';
import { render } from '@testing-library/react';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { AudioRenderer } from '../meeting-context';

describe('AudioRenderer', () => {
  let playMock: any;
  let setSinkIdMock: any;
  
  beforeEach(() => {
    playMock = vi.fn().mockResolvedValue(undefined);
    setSinkIdMock = vi.fn().mockResolvedValue(undefined);
    
    // Mock HTMLMediaElement methods because JSDOM doesn't fully implement them
    window.HTMLMediaElement.prototype.play = playMock;
    (window.HTMLMediaElement.prototype as any).setSinkId = setSinkIdMock;
    
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  test('sets volume correctly based on outputVolume prop', () => {
    const { container, rerender } = render(
      <AudioRenderer isLocal={false} audioOutput="" outputVolume={50} setAudioPlaybackError={vi.fn()} />
    );
    const audio = container.querySelector('audio');
    expect(audio).toBeDefined();
    expect(audio?.volume).toBe(0.5);

    rerender(
      <AudioRenderer isLocal={false} audioOutput="" outputVolume={75} setAudioPlaybackError={vi.fn()} />
    );
    expect(audio?.volume).toBe(0.75);
  });

  test('calls setSinkId when audioOutput changes', () => {
    const { rerender } = render(
      <AudioRenderer isLocal={false} audioOutput="default" outputVolume={50} setAudioPlaybackError={vi.fn()} />
    );
    
    // Initial render should call setSinkId if it's set
    expect(setSinkIdMock).toHaveBeenCalledWith('default');
    
    // Change audioOutput
    rerender(
      <AudioRenderer isLocal={false} audioOutput="bluetooth-headset" outputVolume={50} setAudioPlaybackError={vi.fn()} />
    );
    
    // Should call setSinkId with new device
    expect(setSinkIdMock).toHaveBeenCalledWith('bluetooth-headset');
  });

  test('does not re-attach track or call play when only volume changes (verifying our isolated useEffect fix)', () => {
    const track = {} as MediaStreamTrack;
    
    // Mock MediaStream specifically for this test
    const mockAddTrack = vi.fn();
    const mockRemoveTrack = vi.fn();
    const mockGetAudioTracks = vi.fn().mockReturnValue([track]);
    
    global.MediaStream = class {
      addTrack = mockAddTrack;
      removeTrack = mockRemoveTrack;
      getAudioTracks = mockGetAudioTracks;
    } as any;

    const { rerender } = render(
      <AudioRenderer track={track} isLocal={false} audioOutput="default" outputVolume={50} setAudioPlaybackError={vi.fn()} />
    );

    // Initial render with a track calls play
    expect(playMock).toHaveBeenCalledTimes(1);

    // Change volume
    rerender(
      <AudioRenderer track={track} isLocal={false} audioOutput="default" outputVolume={20} setAudioPlaybackError={vi.fn()} />
    );

    // Play should NOT be called again because the third useEffect (track management) is isolated from volume changes!
    expect(playMock).toHaveBeenCalledTimes(1); 
  });
  
  test('mutes audio if isLocal is true', () => {
    const { container } = render(
      <AudioRenderer isLocal={true} audioOutput="" outputVolume={50} setAudioPlaybackError={vi.fn()} />
    );
    const audio = container.querySelector('audio');
    expect(audio?.muted).toBe(true);
  });
  
  test('adds data-participant-audio="true" attribute for synchronous resume query', () => {
    const { container } = render(
      <AudioRenderer isLocal={false} audioOutput="" outputVolume={50} setAudioPlaybackError={vi.fn()} />
    );
    const audio = container.querySelector('audio');
    expect(audio?.getAttribute('data-participant-audio')).toBe('true');
  });
});
