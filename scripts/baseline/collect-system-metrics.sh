#!/bin/bash
# Collect OS-level system metrics (CPU, Memory, I/O)
echo "Collecting System Metrics at $(date)"
echo "--- CPU ---"
top -b -n 1 | head -n 10
echo "--- Memory ---"
free -m
echo "--- I/O ---"
vmstat 1 5
