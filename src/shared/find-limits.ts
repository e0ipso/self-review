// Bound native query work independently of the amount of review text in the DOM.
// 4 Ki UTF-16 units admits long code phrases while capping each IPC/native query at 8 KiB.
export const MAX_FIND_QUERY_LENGTH = 4096;
// One native request runs at a time; retain at most 31 next/previous steps behind it.
export const MAX_PENDING_FIND_REQUESTS = 32;
