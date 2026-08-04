# 06 Monitoring and Observability Gap Analysis
- Initial Gaps: No TSDB exporter, no granular Time-to-First-Media logs.
- Resolutions: `prom-client` added to `server.ts` and `sfu.ts`. Telemetry events added to `webrtc.ts`.
- Remaining Gaps: End-to-end Kubernetes ingress latency tracking.
