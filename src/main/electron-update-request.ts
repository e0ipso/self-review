import { net } from 'electron';
import type { RequestUpdate } from './update-service';

/** Keep the concrete Electron network session at the desktop composition edge. */
export const requestUpdate: RequestUpdate = options => net.request(options);
