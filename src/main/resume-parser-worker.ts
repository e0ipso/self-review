import { parentPort } from 'node:worker_threads';
import { parseReviewXml } from '../../packages/core/src/xml-parser';
import { describeResumeFailure } from './resume-worker-protocol';
import type { ResumeParseRequest, ResumeParseReply } from './resume-worker-protocol';

if (!parentPort) throw new Error('Resume parser requires a worker message port');
const port = parentPort;
port.once('message', (request: ResumeParseRequest) => {
  if (!request || typeof request.id !== 'string' || typeof request.path !== 'string') {
    throw new Error('Invalid resume parser request');
  }
  let reply: ResumeParseReply;
  try {
    reply = { id: request.id, kind: 'parsed', parsed: parseReviewXml(request.path) };
  } catch (error) {
    reply = { id: request.id, kind: 'failed', error: describeResumeFailure(error) };
  }
  port.postMessage(reply);
  port.close();
});
