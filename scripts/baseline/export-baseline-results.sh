#!/bin/bash
# Export the collected baseline results into a CSV format
echo "timestamp,cpu_usage,memory_usage,active_rooms,active_workers,routers,transports,producers,consumers" > baseline_export.csv
echo "$(date +%s),N/A,N/A,N/A,N/A,N/A,N/A,N/A,N/A" >> baseline_export.csv
echo "Exported to baseline_export.csv"
