import { parentPort } from 'node:worker_threads';
import { parseReviewXml, ReviewXmlError } from '@self-review/core';
import { describeResumeFailure } from '@self-review/core/resume-worker';
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
    const failure = describeResumeFailure(error, error =>
      error instanceof ReviewXmlError ? { code: error.code, details: error.details } : undefined
    );
    reply = {
      id: request.id,
      kind: 'failed',
      error: { ...failure, details: failure.details ? [...failure.details] : undefined },
    };
  }
  port.postMessage(reply);
  port.close();
});
