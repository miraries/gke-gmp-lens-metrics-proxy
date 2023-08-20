import { Compute, GoogleAuth } from 'google-auth-library';
import { JSONClient } from 'google-auth-library/build/src/auth/googleauth';
import { PrometheusPostBody, PrometheusPostResponse } from './types.js';
import config from './config.js';

let client: JSONClient | Compute | undefined;
let projectId: string | undefined = config.googleProjectId;

export async function initialize() {
  const auth = new GoogleAuth({ projectId });

  client = await auth.getClient();
  projectId ??= await auth.getProjectId();

  await client.getAccessToken();
}

export async function queryMetrics(path: string, body: PrometheusPostBody): Promise<PrometheusPostResponse> {
  if (!client || !projectId) {
    throw new Error('Client not initilized');
  }

  const { token } = await client.getAccessToken();

  return fetch(`https://monitoring.googleapis.com/v1/projects/${projectId}/location/global/prometheus` + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + (config.googleAccessToken ?? token),
    },
    body: JSON.stringify(body), // fix
  }).then(r => r.json()).catch(err => ({
    status: 'error',
    err,
  }));
}