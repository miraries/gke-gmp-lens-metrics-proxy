import { PrometheusPostBody, PrometheusPostResponse } from "./types.js";
import { generateSteps } from "./utils.js";

// todo: refactor, use proper promql parsing

export function customQueryHandle(body: PrometheusPostBody) {
  if (body.query.includes('kube_node_status_capacity') && body.query.includes('resource="pods"')) {
    // todo: not sure there's a matching metric for this, hardcoded to 110 per node (3 nodes)
    const pods = body.query.includes('|') ? "330" : "110";
    const steps = generateSteps(Number(body.start), Number(body.end), Number(body.step));

    return {
      "status": "success",
      "data": {
        "resultType": "matrix",
        "result": [
          {
            "metric": {},
            "values": steps.map(s => [s, pods])
          }
        ]
      }
    };
  }

  return null;
}

export function modifyQuery(query: string) {
  // rename common labels
  query = query.replace('namespace=', 'namespace_name=');
  query = query.replace('pod=', 'pod_name=');
  query = query.replace('node=', 'node_name=');

  query = query.replace('by (container, namespace)', 'by (container_name, namespace_name)');
  query = query.replace('by (pod, namespace)', 'by (pod_name, namespace_name)');
  query = query.replace('by (node)', 'by (node_name)');

  if (query.includes('container_cpu_usage_seconds_total')) {
    // rename metric
    return query.replace('container_cpu_usage_seconds_total', 'kubernetes_io:container_cpu_core_usage_time');
  }

  if (query.includes('container_memory_working_set_bytes')) {
    // assuming this is referring to non-evictable memory

    if (query.includes('instance=~')) {
      const node = query.match('instance=~"(.*?)"')![1];
      const nodeParam = node ? `node_name="${node}"` : '';

      return `sum by (metadata_system_node_name)(kubernetes_io:container_memory_used_bytes{memory_type="non-evictable", ${nodeParam}})`;
    }

    if (query.includes('by (node_name)')) {
      return `sum by (metadata_system_node_name)(kubernetes_io:container_memory_used_bytes{memory_type="non-evictable"})`;
    }

    // rename metric
    return query.replace('container_memory_working_set_bytes', 'kubernetes_io:container_memory_used_bytes');
  }

  if (query.includes('kube_pod_container_resource_limits')) {
    const node = query.includes('|') || !query.includes('node_name=~') ? null : query.match('node_name=~"(.*?)"')![1];
    const nodeParam = node ? `{metadata_system_node_name=~"${node}"}` : '';

    // replace with custom metric
    if (query.includes('resource="cpu"')) {
      return `sum by (metadata_system_node_name)(kubernetes_io:container_cpu_limit_cores${nodeParam})`;
    } else if (query.includes('resource="memory"')) {
      return `sum by (metadata_system_node_name)(kubernetes_io:container_memory_limit_bytes${nodeParam})`;
    }
  }

  if (query.includes('kube_pod_container_resource_requests')) {
    const node = query.includes('|') || !query.includes('node_name=~') ? null : query.match('node_name=~"(.*?)"')![1];
    const nodeParam = node ? `{metadata_system_node_name=~"${node}"}` : '';

    // replace with custom metric
    if (query.includes('resource="cpu"')) {
      return `sum by (metadata_system_node_name)(kubernetes_io:container_cpu_request_cores${nodeParam})`;
    } else {
      return `sum by (metadata_system_node_name)(kubernetes_io:container_memory_request_bytes${nodeParam})`;
    }
  }

  if (query.includes('container_network_receive_bytes_total')) {
    // rename metric
    return query.replace('container_network_receive_bytes_total', 'kubernetes_io:pod_network_received_bytes_count');
  }

  if (query.includes('container_network_transmit_bytes_total')) {
    // rename metric
    return query.replace('container_network_transmit_bytes_total', 'kubernetes_io:pod_network_sent_bytes_count');
  }

  if (query.includes('kube_node_status_allocatable')) {
    if (query.includes('resource="cpu"')) {
      // remove label
      query = query.replace('resource="cpu"', '');

      // rename metric
      query = query.replace('kube_node_status_allocatable', 'kubernetes_io:node_cpu_allocatable_cores');
    } else if (query.includes('resource="memory"')) {
      // remove label
      query = query.replace('resource="memory"', '');

      // rename metric
      query = query.replace('kube_node_status_allocatable', 'kubernetes_io:node_memory_allocatable_bytes');
    } else if (query.includes('resource="pods"')) {
      const node = query.includes('|') ? null : query.match('=~"(.*?)"')![1];
      const nodeParam = node ? `,metadata_system_node_name="${node}"` : '';

      // todo: not sure there's a matching metric for this, assuming 110 pods per node
      return `${node ? 110 : 330} - sum(count by (metadata_system_node_name)(kubernetes_io:container_uptime{monitored_resource="k8s_container"${nodeParam}}))`;
    }

    return query;
  }

  if (query.includes('kube_node_status_capacity')) {
    if (query.includes('resource="cpu"')) {
      // remove label
      query = query.replace('resource="cpu"', '');

      // rename metric
      query = query.replace('kube_node_status_capacity', 'kubernetes_io:node_cpu_total_cores');
    } else if (query.includes('resource="memory"')) {
      // remove label
      query = query.replace('resource="memory"', '');

      // rename metric
      query = query.replace('kube_node_status_capacity', 'kubernetes_io:node_memory_total_bytes');
    }
    // `pods` resource is handled with customQueryHandle as GMP does not provide a metric for this

    return query;
  }

  if (query.includes('node_cpu_seconds_total')) {
    if (query.includes('by (node_name)')) {
      return 'sum(rate(kubernetes_io:node_cpu_core_usage_time[1m])) by (node_name)';
    }

    const node = query.includes('node_name=~') ? query.match('node_name=~"(.*?)"')![1] : null;
    const nodeParam = node ? `{node_name=~"${node}"}` : '';

    // replace with custom query
    return `sum(rate(kubernetes_io:node_cpu_core_usage_time${nodeParam}[1m]))`;
  }

  if (query.includes('kubelet_volume_stats_used_bytes')) {
    // replace with custom metric
    return query.replace('kubelet_volume_stats_used_bytes', 'kubernetes_io:pod_volume_used_bytes');
  }

  if (query.includes('kubelet_volume_stats_capacity_bytes')) {
    // replace with custom metric
    return query.replace('kubelet_volume_stats_capacity_bytes', 'kubernetes_io:pod_volume_total_bytes');
  }

  if (query.includes('kubelet_running_pod_count|kubelet_running_pods')) {
    // replace with custom query
    const node = query.includes('node_name=~') ? query.match('node_name=~"(.*?)"')![1] : null;
    const nodeParam = node ? `,metadata_system_node_name=~"${node}"` : '';

    return `sum(count by (metadata_system_node_name)(kubernetes_io:container_uptime{monitored_resource="k8s_container"${nodeParam}}))`;
  }

  // replace with custom queries
  if (query.includes('node_filesystem_size_bytes')) {
    const node = query.includes('node_name=~') ? query.match('node_name=~"(.*?)"')![1] : null;
    const nodeParam = node ? `{node_name=~"${node}"}` : '';

    if (query.includes('node_filesystem_avail_bytes')) {
      if (query.includes('by (node_name)')) {
        return 'kubernetes_io:node_ephemeral_storage_used_bytes';
      }

      return `sum(kubernetes_io:node_ephemeral_storage_used_bytes${nodeParam})`
    }

    if (query.includes('by (node_name)')) {
      return 'kubernetes_io:node_ephemeral_storage_total_bytes';
    }

    return `sum(kubernetes_io:node_ephemeral_storage_total_bytes${nodeParam})`;
  }

  // replace with custom queries
  if (query.includes('node_memory_MemTotal_bytes')) {
    if (query.includes('|')) { // all nodes
      return 'sum(kubernetes_io:node_memory_used_bytes)';
    }

    if (query.includes('by (node_name)')) {
      return 'sum(kubernetes_io:node_memory_used_bytes) by (node_name)';
    }

    const node = query.includes('node_name=~') ? query.match('node_name=~"(.*?)"')![1] : null;
    const nodeParam = node ? `{node_name="${node}"}` : '';

    return `sum(kubernetes_io:node_memory_used_bytes${nodeParam})`;
  }
}

export function modifyResponse(body: PrometheusPostResponse) {
  // rename metrics back to ones expected by lens

  body.data.result.forEach(r => {
    if (r?.metric?.namespace_name) {
      r.metric.namespace = r.metric.namespace_name;
      r.metric.namespace_name = undefined;
    }

    if (r?.metric?.pod_name) {
      r.metric.pod = r.metric.pod_name;
      r.metric.pod_name = undefined;
    }

    if (r?.metric?.container_name) {
      r.metric.container = r.metric.container_name;
      r.metric.container_name = undefined;
    }

    if (r?.metric?.node_name) {
      r.metric.node = r.metric.node_name;
      r.metric.node_name = undefined;
    }

    if (r?.metric?.metadata_system_node_name) {
      r.metric.node = r.metric.metadata_system_node_name;
      r.metric.metadata_system_node_name = undefined;
    }
  });

  return body;
}