import { parentPort } from 'node:worker_threads';
import { decodeJsonBody } from './json-body-codec';
import { encodeJsonWorkerReply } from './json-body-transfer';

if (!parentPort) throw new Error('JSON parser requires a worker message port.');
const port = parentPort;
port.once('message', (chunks: ArrayBuffer[]) => {
  port.postMessage(
    encodeJsonWorkerReply(decodeJsonBody(chunks.map(chunk => new Uint8Array(chunk))))
  );
  port.close();
});
