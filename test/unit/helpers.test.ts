import { describe, it, expect } from 'vitest';
import { calculateSubscriptionEndDate, determineRecordingAccess, isValidStatusTransition } from '../../src/utils/helpers';

describe('Helper Functions', () => {
  describe('calculateSubscriptionEndDate', () => {
    it('should add durationDays to current date if currentEnd is null', () => {
      const now = new Date();
      const end = calculateSubscriptionEndDate(null, { durationDays: 30 });
      expect(end.getTime()).toBeGreaterThan(now.getTime());
      // approx 30 days
      expect(end.getTime() - now.getTime()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });

    it('should extend currentEnd if it is in the future', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const end = calculateSubscriptionEndDate(future, { durationDays: 15 });
      expect(end.getTime() - future.getTime()).toBeGreaterThan(14 * 24 * 60 * 60 * 1000);
    });
  });

  describe('determineRecordingAccess', () => {
    it('should allow owner access', () => {
      expect(determineRecordingAccess({ ownerId: 'user1', isPrivate: true }, 'user1', false)).toBe(true);
    });

    it('should deny non-owner access to private recording', () => {
      expect(determineRecordingAccess({ ownerId: 'user1', isPrivate: true }, 'user2', true)).toBe(false);
    });

    it('should allow access to public free recording', () => {
      expect(determineRecordingAccess({ ownerId: 'user1', isPrivate: false, priceKobo: 0 }, 'user2', false)).toBe(true);
    });

    it('should allow access to paid recording if user has paid', () => {
      expect(determineRecordingAccess({ ownerId: 'user1', isPrivate: false, priceKobo: 50000 }, 'user2', true)).toBe(true);
    });

    it('should deny access to paid recording if user has not paid', () => {
      expect(determineRecordingAccess({ ownerId: 'user1', isPrivate: false, priceKobo: 50000 }, 'user2', false)).toBe(false);
    });
  });

  describe('isValidStatusTransition', () => {
    it('should allow valid transitions', () => {
      expect(isValidStatusTransition('starting', 'recording')).toBe(true);
      expect(isValidStatusTransition('recording', 'stopping')).toBe(true);
    });

    it('should deny invalid transitions', () => {
      expect(isValidStatusTransition('completed', 'recording')).toBe(false);
      expect(isValidStatusTransition('pending', 'completed')).toBe(false);
    });
  });
});
