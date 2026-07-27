#!/bin/bash
# Check health of Konn3ct backend
echo "Checking API Health..."
curl -s http://localhost:3000/health | grep -i "status"
echo "Checking Metrics Endpoint..."
curl -s http://localhost:3000/metrics | head -n 5
echo "Health Check Complete."
