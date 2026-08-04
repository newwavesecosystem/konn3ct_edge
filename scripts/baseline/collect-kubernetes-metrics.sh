#!/bin/bash
# Collect Kubernetes Pod and Node metrics
echo "Collecting Kubernetes Metrics at $(date)"
echo "--- Nodes ---"
kubectl top nodes
echo "--- Pods (Konn3ct Namespace) ---"
kubectl top pods -n konn3ct-prod
echo "--- Endpoints ---"
kubectl get endpoints -n konn3ct-prod
