import { parentPort } from 'node:worker_threads';
import { parseReviewXml } from '@self-review/core';
import type { ResumeParseRequest, ResumeParseReply } from './resume-worker-lifetime';

if (!parentPort) throw new Error('Resume parser requires a worker message port');
const port = parentPort;
port.once('message', (request: ResumeParseRequest) => {
  if (!request || typeof request.id !== 'string' || typeof request.path !== 'string')
    throw new Error('Invalid resume parser request');
  let reply: ResumeParseReply;
  try {
    reply = { id: request.id, kind: 'parsed', parsed: parseReviewXml(request.path) };
  } catch (error) {
    // Structured clone does not retain custom Error fields or prototypes.
    const failure = error as { message?: string; code?: string; details?: string[] };
    reply = {
      id: request.id,
      kind: 'failed',
      error: {
        message: failure?.message ?? String(error),
        code: failure?.code,
        details: failure?.details,
      },
    };
  }
  port.postMessage(reply);
  port.close();
});
