# GMP Lens Metrics Proxy

**GMP Lens Metrics Proxy** provides a simple way to see metrics in [Lens](https://k8slens.dev) if you're using [Google Cloud Managed Service for Prometheus (GMP)](https://cloud.google.com/stackdriver/docs/managed-prometheus) on your [Google Kubernetes Engine (GKE)](https://cloud.google.com/kubernetes-engine) cluster.

Lens only supports metrics provided by prometheus operator. This project acts as a proxy and maps those queries to use ones provided by GMP.

Metrics supported:
- **Memory** usage/capacity
- **CPU** usage/capacity
- **Volume** usage/capacity
- **Pods** usage/capacity (partly supported)

for **Cluster**, **Node** and **Pod**.

## Deployment

1. Create a google service account that has access to Monitoring.
2. Create and bind a k8s service account using [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity).
3. Deploy [miraries/gke-gmp-lens-metrics-proxy](https://hub.docker.com/r/miraries/gke-gmp-lens-metrics-proxy)
4. Point Lens to the deployment
5. Done!

For a detailed guide with examples check [docs/deployment.md](docs/Deployment.md)

## Notes

The mapping of queries is far from ideal - queries are not properly parsed as promql. Instead, only specific queries and labels used by Lens are handled.

Container filesystem metrics are not mapped as no adequate metric exists in GMP (or I couldn't find one).

Node pod capacity is not mapped for similar reasons, but it's faked with hardcoded data as it doesn't change often and the default for GKE clusters is known. This can be improved upon by querying the node info through the k8s api.