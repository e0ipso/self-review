// Core 2.0.4 exposes parsing and origin recording but predates adoption.
// Remove this fallback only when every supported Core exposes adoptResumeDocument.
// Project its public loadResumeDocument assignment contract after worker parsing.
// Authorization and path policy remain solely in recordResumedAttachments.
import type * as core from '@self-review/core';
import type { ParsedReview, ReviewSession } from '@self-review/core';

interface ResumeEngine {
  adoptResumeDocument?: typeof core.adoptResumeDocument;
  recordResumedAttachments: typeof core.recordResumedAttachments;
}
export function resumeAdopterFor(engine: ResumeEngine) {
  if (engine.adoptResumeDocument) return engine.adoptResumeDocument;
  const record = engine.recordResumedAttachments;
  return (session: ReviewSession, parsed: ParsedReview, path: string): ParsedReview => {
    const attachments = { attachmentOrigins: session.attachmentOrigins };
    const diagnostics = record(attachments, parsed.comments, path);
    session.attachmentOrigins = attachments.attachmentOrigins;
    session.resumeComments = parsed.comments;
    session.resumeViewedFiles = parsed.viewedFiles;
    session.resumeImportDiagnostics = [...parsed.importDiagnostics, ...diagnostics];
    return parsed;
  };
}
