import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import pino from 'pino';
import config from './config.js';
import * as modifier from './modifier.js';
import * as googleApi from './googleApi.js';
import { PrometheusPostBody, PrometheusPostResponse } from './types.js';

const logger = pino({
  level: config.logLevel,
});

const app = Fastify({ logger });

app.register(multipart, { attachFieldsToBody: 'keyValues' });

app.post('*', async (req) => {
  const body = req.body as PrometheusPostBody; // no need to validate schema
  const query = body.query;

  let modifiedQuery: string | undefined;

  if (query) {
    const customHandleResult = modifier.customQueryHandle(body);

    if (customHandleResult) {
      logger.info({
        query,
        response: customHandleResult,
      }, 'Returning custom metrics');

      return customHandleResult;
    }

    modifiedQuery = modifier.modifyQuery(query);
  }

  if ('kubernetes_namespace' in body) {
    delete body.kubernetes_namespace;
  }

  const responseBody = await googleApi.queryMetrics(req.raw.url as string, {
    ...body,
    query: modifiedQuery ?? query,
  });

  let modifiedResponseBody: PrometheusPostResponse | undefined;

  if (responseBody?.status === 'success' && responseBody?.data?.result?.length > 0) {
    modifiedResponseBody = modifier.modifyResponse(responseBody);
  }

  if (responseBody?.status === 'error') {
    logger.error({
      query,
      modifiedQuery,
      body: responseBody,
    }, 'Invalid query');
  } else if (responseBody?.status === 'UNAUTHENTICATED') {
    logger.error({
      query,
      modifiedQuery,
      body: responseBody,
    }, 'Expired token');
  } else {
    logger.info({
      query,
      modifiedQuery,
      body: responseBody,
    }, 'Response');
  }

  return modifiedResponseBody ?? responseBody;
})

await googleApi.initialize();

app.listen({ port: config.appPort, host: '0.0.0.0' }, function (err) {
  if (err) {
    logger.error(err)
    process.exit(1)
  }

  logger.warn(`App is running at ${config.appPort}`);
});

