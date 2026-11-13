import type { DiffLoadPayload, GuideLoadPayload, ResumeLoadPayload } from '../shared/types';
import { IPC } from '../shared/ipc-channels';
import {
  prepareDiffDelivery,
  prepareResumeLoad,
  prepareDiffDeliveryAsync,
  prepareResumeLoadAsync,
} from './ipc-delivery';

/** A replacement is admitted only after every wire piece is ready. Adoption keeps the host's
 * original payload, identity and capture. A lost peer after adoption cannot undo that commit;
 * it receives no later readiness acknowledgement and a new peer must pull the current session. */
export function replaceReview(
  content: {
    payload: DiffLoadPayload;
    guide: GuideLoadPayload | null;
    resume: ResumeLoadPayload;
  },
  owner: {
    assertCurrent: () => void;
    signal: AbortSignal;
    send: (channel: string, payload: unknown) => void;
  },
  adopt: () => void
): void {
  const { diff, guide } = prepareDiffDelivery(content.payload, content.guide);
  const resume = prepareResumeLoad(content.resume);
  deliverReplacement({ diff, guide, resume }, owner, adopt);
}

function deliverReplacement(
  {
    diff,
    guide,
    resume,
  }: { diff: DiffLoadPayload; guide: GuideLoadPayload | null; resume: ResumeLoadPayload },
  owner: Parameters<typeof replaceReview>[1],
  adopt: () => void
): void {
  const current = () => {
    owner.signal.throwIfAborted();
    owner.assertCurrent();
  };
  current();
  adopt();
  // The transition's old welcome is intentionally stale after adoption. Peer and operation
  // checks still apply before each ordered message; callers keep those checks separate.
  current();
  owner.send(IPC.DIFF_LOAD, diff);
  if (guide) {
    current();
    owner.send(IPC.GUIDE_LOAD, guide);
  }
  current();
  owner.send(IPC.RESUME_LOAD, resume);
  current();
}

/** Prepare every piece under the old owner, then adopt and send without yielding. */
export async function replaceReviewAsync(
  content: Parameters<typeof replaceReview>[0],
  owner: Parameters<typeof replaceReview>[1],
  adopt: () => void,
  assertPreparing: () => void = owner.assertCurrent
): Promise<void> {
  const current = () => {
    owner.signal.throwIfAborted();
    owner.assertCurrent();
    assertPreparing();
  };
  const { diff, guide } = await prepareDiffDeliveryAsync(content.payload, content.guide, current);
  const resume = await prepareResumeLoadAsync(content.resume, current);
  current();
  deliverReplacement({ diff, guide, resume }, owner, adopt);
}
