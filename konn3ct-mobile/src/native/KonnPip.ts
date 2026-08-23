/**
 * KonnPip.ts
 * 
 * JS bridge for our custom native PiP module (KonnPip).
 * Works with React Native New Architecture (Bridgeless).
 */
import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

const { KonnPip } = NativeModules;

// NativeEventEmitter requires the native module to have addListener/removeListeners methods.
// Our PipModule.kt already implements these.
const emitter = Platform.OS === 'android' && KonnPip
  ? new NativeEventEmitter(KonnPip)
  : null;

const PipService = {
  /**
   * Returns true if the native PiP module is available on this device.
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!KonnPip;
  },

  /**
   * Tell the native side whether a meeting is currently in progress.
   * When true, pressing Home will auto-enter PiP mode (like Google Meet).
   */
  setMeetingActive(active: boolean): void {
    if (KonnPip) {
      KonnPip.setMeetingActive(active);
    }
  },

  /**
   * Enter Picture-in-Picture mode.
   * @param width  Aspect ratio width  (default 16)
   * @param height Aspect ratio height (default 9)
   */
  enter(width = 16, height = 9): void {
    if (KonnPip) {
      KonnPip.enterPipMode(width, height);
    }
  },

  /**
   * Subscribe to PiP mode changes.
   * @param listener  Called with `true` when entering PiP, `false` when leaving.
   * @returns  An EmitterSubscription you must call .remove() on to unsubscribe.
   */
  onModeChanged(listener: (isInPip: boolean) => void): EmitterSubscription | null {
    return emitter?.addListener('KonnPipModeChanged', listener) ?? null;
  },

  /**
   * Update the microphone state in PiP control actions dynamically.
   */
  updateMuteState(isMuted: boolean): void {
    if (KonnPip && KonnPip.updateMuteState) {
      KonnPip.updateMuteState(isMuted);
    }
  },

  /**
   * Subscribe to PiP actions (e.g. mute toggle, leave meeting).
   * @param listener Called with { action: 'toggle_mute' | 'leave' }
   * @returns An EmitterSubscription you must call .remove() on to unsubscribe.
   */
  onPipAction(listener: (data: { action: string }) => void): EmitterSubscription | null {
    return emitter?.addListener('KonnPipAction', listener) ?? null;
  },
};

export default PipService;
