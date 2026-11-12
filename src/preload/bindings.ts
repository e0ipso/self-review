import { IPC } from '../shared/ipc-channels';
import type { ElectronAPI } from '../shared/types';

// Only bridge channels are eligible. PAYLOAD_GUARD_SHOW belongs to main alone.
type BridgeChannel = (typeof IPC)[Exclude<keyof typeof IPC, 'PAYLOAD_GUARD_SHOW'>];

type BindingFor<Method> =
  NonNullable<Method> extends (...args: infer Args) => infer Result
    ? Result extends Promise<unknown>
      ? readonly ['invoke', BridgeChannel]
      : Result extends () => void
        ? Args extends [callback: (...args: infer _PushArgs) => void]
          ? readonly ['subscribe', BridgeChannel]
          : never
        : Result extends void
          ? readonly ['send', BridgeChannel]
          : never
    : never;

// Removing optionality here makes every capability mandatory in the first-party bridge.
// ElectronAPI remains the explicit public signature and optionality contract.
export type PreloadBindings<API> = { [Method in keyof API]-?: BindingFor<API[Method]> };

export const PRELOAD_BINDINGS = {
  readContent: ['invoke', IPC.CONTENT_READ],
  cancelContentRead: ['send', IPC.CONTENT_CANCEL],
  onContentRefused: ['subscribe', IPC.CONTENT_REFUSED],
  requestDiffData: ['send', IPC.DIFF_REQUEST],
  onDiffLoad: ['subscribe', IPC.DIFF_LOAD],
  requestConfig: ['send', IPC.CONFIG_REQUEST],
  onConfigLoad: ['subscribe', IPC.CONFIG_LOAD],
  requestResumeData: ['send', IPC.RESUME_REQUEST],
  onResumeLoad: ['subscribe', IPC.RESUME_LOAD],
  onGuideLoad: ['subscribe', IPC.GUIDE_LOAD],
  submitReview: ['send', IPC.REVIEW_SUBMIT],
  onCloseRequested: ['subscribe', IPC.APP_CLOSE_REQUESTED],
  saveAndQuit: ['send', IPC.APP_SAVE_AND_QUIT],
  handoffReview: ['invoke', IPC.REVIEW_HANDOFF],
  saveReview: ['invoke', IPC.REVIEW_SAVE],
  getSaveResult: ['invoke', IPC.REVIEW_SAVE_STATUS],
  acknowledgeReviewSave: ['send', IPC.REVIEW_SAVE_RECEIVED],
  onSaveFailed: ['subscribe', IPC.REVIEW_SAVE_FAILED],
  getApplicationLocale: ['invoke', IPC.APP_LOCALE],
  readAttachment: ['invoke', IPC.ATTACHMENT_READ],
  discardAndQuit: ['send', IPC.APP_DISCARD_AND_QUIT],
  pickDirectory: ['invoke', IPC.DIALOG_PICK_DIRECTORY],
  startDirectoryReview: ['invoke', IPC.REVIEW_START_DIRECTORY],
  expandContext: ['invoke', IPC.DIFF_EXPAND_CONTEXT],
  changeOutputPath: ['invoke', IPC.OUTPUT_PATH_CHANGE],
  onOutputPathChanged: ['subscribe', IPC.OUTPUT_PATH_CHANGED],
  findInPage: ['send', IPC.FIND_IN_PAGE],
  stopFindInPage: ['send', IPC.FIND_STOP],
  onFindResult: ['subscribe', IPC.FIND_RESULT],
  requestVersionUpdate: ['send', IPC.VERSION_UPDATE_REQUEST],
  onVersionUpdate: ['subscribe', IPC.VERSION_UPDATE_AVAILABLE],
  openExternal: ['invoke', IPC.OPEN_EXTERNAL],
  loadFileContent: ['invoke', IPC.DIFF_LOAD_FILE],
  loadImage: ['invoke', IPC.DIFF_LOAD_IMAGE],
  openRemoteUrl: ['invoke', IPC.REMOTE_OPEN_URL],
  applySuggestion: ['invoke', IPC.SUGGESTION_APPLY],
  chooseApplyDestination: ['invoke', IPC.SUGGESTION_CHOOSE_DESTINATION],
  onShowAbout: ['subscribe', IPC.APP_SHOW_ABOUT],
  getAppInfo: ['invoke', IPC.APP_GET_INFO],
} as const satisfies PreloadBindings<ElectronAPI>;
