import logger from '../logger';
import { RoomTopologyRegistry } from './RoomTopologyRegistry';
import { TopologyFailoverCoordinator } from './TopologyFailoverCoordinator';
import { TOPOLOGY_FAILOVER_CONFIG } from '../types/topology';

export interface PodGracefulShutdownResult {
  success: boolean;
  mediaPodId: string;
  isDraining: boolean;
  affectedRoomsCount: number;
  migratedViewersCount: number;
  hardDeadlineReached: boolean;
  error?: string;
}

export class MediaPodGracefulShutdownService {
  private static drainingPods: Set<string> = new Set();
  private static signalListenersRegistered: Set<string> = new Set();

  /**
   * Register SIGTERM / SIGINT signal listeners for OS / Kubernetes pod shutdown
   */
  public static registerSignalListeners(mediaPodId: string, targetRelayPodId?: string): void {
    if (this.signalListenersRegistered.has(mediaPodId)) return;
    this.signalListenersRegistered.add(mediaPodId);

    const handleSignal = async (signal: string) => {
      logger.warn(JSON.stringify({ event: 'os_shutdown_signal_received', signal, mediaPodId, timestamp: Date.now() }));
      await MediaPodGracefulShutdownService.initiateGracefulPodDrain(mediaPodId, targetRelayPodId);
    };

    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
  }

  /**
   * Initiate graceful pod draining (Idempotent: duplicate requests return immediately)
   */
  public static async initiateGracefulPodDrain(
    mediaPodId: string,
    targetRelayPodId?: string
  ): Promise<PodGracefulShutdownResult> {
    if (this.drainingPods.has(mediaPodId)) {
      logger.info(JSON.stringify({ event: 'pod_drain_already_in_progress', mediaPodId }));
      return {
        success: true,
        mediaPodId,
        isDraining: true,
        affectedRoomsCount: 0,
        migratedViewersCount: 0,
        hardDeadlineReached: false,
      };
    }

    this.drainingPods.add(mediaPodId);
    logger.warn(JSON.stringify({ event: 'pod_graceful_drain_initiated', mediaPodId, targetRelayPodId }));

    const startTime = Date.now();
    const hardDeadlineMs = TOPOLOGY_FAILOVER_CONFIG.RELAY_DRAIN_HARD_DEADLINE_MS; // 60,000ms
    let migratedViewersCount = 0;
    let affectedRoomsCount = 0;
    let hardDeadlineReached = false;

    try {
      // 1. Mark all relay routers on this pod as DRAINING to block new allocations
      const activeRooms = await RoomTopologyRegistry.getActiveRoomsForPod(mediaPodId);
      affectedRoomsCount = activeRooms.length;

      for (const roomId of activeRooms) {
        const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
        if (!topology) continue;

        for (const [rKey, routerNode] of Object.entries(topology.routers)) {
          if (routerNode.mediaPodId === mediaPodId && routerNode.role === 'relay') {
            await RoomTopologyRegistry.drainRelayRouter(roomId, rKey);

            if (targetRelayPodId) {
              // Find existing ready router on target pod or create router-relay-2
              let newRelayKey = Object.entries(topology.routers).find(
                ([k, r]) => r.mediaPodId === targetRelayPodId && r.role === 'relay' && r.state === 'READY'
              )?.[0];

              if (!newRelayKey) {
                newRelayKey = `${targetRelayPodId}:router-relay-2`;
                await RoomTopologyRegistry.registerRelayRouter(roomId, newRelayKey, targetRelayPodId, { state: 'READY' });
              }

              const res = await TopologyFailoverCoordinator.executeRelayMigration(roomId, rKey, newRelayKey, true);
              if (res.success) {
                migratedViewersCount += res.migratedViewers;
              }
              await RoomTopologyRegistry.closeRelayRouter(roomId, rKey);
            }
          }
        }

        // Check hard deadline
        if (Date.now() - startTime > hardDeadlineMs) {
          hardDeadlineReached = true;
          logger.warn(JSON.stringify({ event: 'pod_drain_hard_deadline_reached', mediaPodId, elapsedTimeMs: Date.now() - startTime }));
          break;
        }
      }

      logger.info(JSON.stringify({
        event: 'pod_graceful_drain_completed',
        mediaPodId,
        elapsedTimeMs: Date.now() - startTime,
        migratedViewersCount,
        hardDeadlineReached,
      }));

      return {
        success: true,
        mediaPodId,
        isDraining: true,
        affectedRoomsCount,
        migratedViewersCount,
        hardDeadlineReached,
      };
    } catch (err: any) {
      logger.error(`Error during graceful pod drain for ${mediaPodId}`, err);
      return {
        success: false,
        mediaPodId,
        isDraining: true,
        affectedRoomsCount,
        migratedViewersCount,
        hardDeadlineReached,
        error: err.message,
      };
    }
  }

  public static isPodDraining(mediaPodId: string): boolean {
    return this.drainingPods.has(mediaPodId);
  }

  public static resetPodDrainState(mediaPodId: string): void {
    this.drainingPods.delete(mediaPodId);
    this.signalListenersRegistered.delete(mediaPodId);
  }
}
