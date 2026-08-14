# 07 Baseline Test Execution Guide
To execute tests:
1. Provision infrastructure.
2. Run `scripts/baseline/baseline-health-check.sh`.
3. Launch Puppeteer bots for Profiles A through J.
4. Run `scripts/baseline/collect-*-metrics.sh` during peak load.
5. Run `scripts/baseline/export-baseline-results.sh` to finalize.
