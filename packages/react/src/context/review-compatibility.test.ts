import { expect, it } from 'vitest';
import { projectReviewContext } from './review-compatibility';
import { createReviewStateQueries } from './review-state-queries';
import { createReviewStateCommands } from './review-state-commands';
import { createSessionCommands } from './review-commands';
import { createReviewSessionController } from './review-session-controller';
import { createReviewSession, createReviewSessionStore } from './review-session';

it('projects the legacy context from only its two query dependencies without wrapping getters', () => {
  const store = createReviewSessionStore(createReviewSession([]));
  const operations = createReviewStateCommands(
    update => store.dispatch({ type: 'files', update }),
    () => 'id'
  );
  const commands = createSessionCommands(
    store,
    createReviewSessionController(store, null),
    operations
  );
  const queries: Parameters<typeof projectReviewContext>[4] = createReviewStateQueries([]);
  const retry = async () => {};
  const context = projectReviewContext(
    store,
    store.getSnapshot(),
    [],
    commands,
    queries,
    retry,
    retry
  );
  expect(context.getCommentsForFile).toBe(queries.getCommentsForFile);
  expect(context.getCommentsForLine).toBe(queries.getCommentsForLine);
  expect(context.getCommentsForFile('missing')).toEqual([]);
  expect(context.getCommentsForLine('missing', 1, 'new')).toEqual([]);
  expect(context.editComment).toBe(commands.editComment);
  expect(context.retryLoad).toBe(retry);
});
