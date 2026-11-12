import { expectTypeOf, it } from 'vitest';
import { PRELOAD_BINDINGS, type PreloadBindings } from './bindings';
import { IPC } from '../shared/ipc-channels';
import type {
  ElectronAPI,
  AppInfo,
  DesktopReadRequest,
  DesktopReadResult,
  ContentLoadRefusal,
  ReviewSaveResult,
  ApplicationLocale,
  DiffLoadPayload,
  AppConfig,
  OutputPathInfo,
  ResumeLoadPayload,
  GuideLoadPayload,
  ReviewState,
  ExpandContextRequest,
  ExpandContextResponse,
  FindInPageRequest,
  FindInPageResult,
  VersionUpdateInfo,
  DiffHunk,
  ImageLoadResult,
  RemoteOpenUrlResult,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from '../shared/types';

// Source-only consumer frozen before the binding refactor. This is deliberately
// independent of the catalog and checks required/optional property shapes too.
interface OriginalElectronAPI {
  /** Optional correlated reads. No AbortSignal crosses structured clone. */
  readContent?: (request: DesktopReadRequest) => Promise<DesktopReadResult>;
  cancelContentRead?: (requestId: string) => void;
  onContentRefused?: (callback: (failure: ContentLoadRefusal) => void) => () => void;
  requestDiffData: () => void;
  onDiffLoad: (callback: (payload: DiffLoadPayload) => void) => () => void;
  requestConfig: () => void;
  onConfigLoad: (
    callback: (payload: AppConfig, outputPathInfo?: OutputPathInfo) => void
  ) => () => void;
  requestResumeData: () => void;
  onResumeLoad: (callback: (payload: ResumeLoadPayload) => void) => () => void;
  onGuideLoad: (callback: (payload: GuideLoadPayload) => void) => () => void;
  submitReview: (state: ReviewState) => void;
  onCloseRequested: (callback: () => void) => () => void;
  saveAndQuit: () => void;
  /** Optional acknowledged state handoff, never publication. */
  handoffReview?: (state: ReviewState) => Promise<void>;
  /** Publish one snapshot. No close until acknowledgeReviewSave receives its receipt. */
  saveReview?: (state: ReviewState) => Promise<ReviewSaveResult>;
  getSaveResult?: () => Promise<ReviewSaveResult | null>;
  acknowledgeReviewSave?: (receipt: string) => void;
  /** Legacy save failure notification; older peers may omit it. */
  onSaveFailed?: (callback: () => void) => () => void;
  getApplicationLocale?: () => Promise<ApplicationLocale>;
  readAttachment: (filePath: string) => Promise<ArrayBuffer | null>;
  discardAndQuit: () => void;
  pickDirectory: () => Promise<string | null>;
  startDirectoryReview: (path: string) => Promise<void>;
  expandContext: (request: ExpandContextRequest) => Promise<ExpandContextResponse | null>;
  changeOutputPath: () => Promise<OutputPathInfo | null>;
  onOutputPathChanged: (callback: (info: OutputPathInfo) => void) => () => void;
  findInPage: (request: FindInPageRequest) => void;
  stopFindInPage: (action: string) => void;
  onFindResult: (callback: (result: FindInPageResult) => void) => () => void;
  requestVersionUpdate: () => void;
  onVersionUpdate: (callback: (info: VersionUpdateInfo) => void) => () => void;
  onShowAbout: (callback: () => void) => () => void;
  getAppInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => Promise<void>;
  loadFileContent: (filePath: string) => Promise<DiffHunk[] | null>;
  loadImage: (filePath: string) => Promise<ImageLoadResult>;
  openRemoteUrl: (url: string) => Promise<RemoteOpenUrlResult>;
  applySuggestion: (request: SuggestionApplyRequest) => Promise<SuggestionApplyOutcome>;
  chooseApplyDestination: () => Promise<ApplyDestinationOutcome>;
}

it('retains the original explicit consumer contract in both directions', () => {
  expectTypeOf<ElectronAPI>().toEqualTypeOf<OriginalElectronAPI>();
});

// Compiled by typecheck:unit. Never execute invalid declarations against Electron.
function checkBindingConstraints(api: ElectronAPI, original: OriginalElectronAPI) {
  const originalConsumer: OriginalElectronAPI = api;
  const currentConsumer: ElectronAPI = original;
  const { readContent, ...withoutRead } = PRELOAD_BINDINGS;
  const { requestDiffData, ...withoutRequest } = PRELOAD_BINDINGS;
  // @ts-expect-error Optional public methods still need first-party bindings.
  const missingOptional: PreloadBindings<ElectronAPI> = withoutRead;
  // @ts-expect-error Required public methods must have a binding.
  const missingRequired: PreloadBindings<ElectronAPI> = withoutRequest;
  type ExtendedAPI = ElectronAPI & { futureCapability?: () => Promise<void> };
  // @ts-expect-error A new optional capability must fail until explicitly bound.
  const missingFuture: PreloadBindings<ExtendedAPI> = PRELOAD_BINDINGS;
  // @ts-expect-error Invocations cannot become unacknowledged sends.
  const wrongInvoke: PreloadBindings<ElectronAPI>['saveReview'] = ['send', IPC.REVIEW_SAVE];
  // @ts-expect-error Send signatures cannot become invocations.
  const wrongSend: PreloadBindings<ElectronAPI>['submitReview'] = ['invoke', IPC.REVIEW_SUBMIT];
  // @ts-expect-error Subscription signatures cannot become invocations.
  const wrongPush: PreloadBindings<ElectronAPI>['onDiffLoad'] = ['invoke', IPC.DIFF_LOAD];
  const wrongSubscription: PreloadBindings<ElectronAPI>['stopFindInPage'] = [
    // @ts-expect-error Ordinary sends cannot become subscriptions.
    'subscribe',
    IPC.FIND_STOP,
  ];
  const invalidChannel: PreloadBindings<ElectronAPI>['pickDirectory'] = [
    'invoke',
    // @ts-expect-error Unknown wire names are forbidden.
    'arbitrary:channel',
  ];
  const mainOnlyChannel: PreloadBindings<ElectronAPI>['pickDirectory'] = [
    'invoke',
    // @ts-expect-error Main-only channels are not bridge capabilities.
    IPC.PAYLOAD_GUARD_SHOW,
  ];
  const invalidCallback: PreloadBindings<{ bad: (value: string) => () => void }> = {
    // @ts-expect-error Non-callback disposer signatures cannot be subscriptions.
    bad: ['subscribe', IPC.DIFF_LOAD],
  };
  // @ts-expect-error Non-wire synchronous return types have no transport mode.
  const invalidResult: PreloadBindings<{ bad: () => number }> = { bad: ['send', IPC.DIFF_REQUEST] };
  void [
    originalConsumer,
    currentConsumer,
    readContent,
    requestDiffData,
    missingOptional,
    missingRequired,
    missingFuture,
    wrongInvoke,
    wrongSend,
    wrongPush,
    wrongSubscription,
    invalidChannel,
    mainOnlyChannel,
    invalidCallback,
    invalidResult,
  ];
}
void checkBindingConstraints;
