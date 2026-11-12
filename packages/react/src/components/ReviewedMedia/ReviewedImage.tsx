import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  memo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ExtraProps } from 'react-markdown';
import type { ReviewSessionStore } from '../../context/review-session';
import type { DiffFile } from '@self-review/types';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { ReviewContext, SessionStoreContext } from '../../context/review-context';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { useLocalization } from '../../localization/LocalizationContext';
import { loadImage } from '../../read-service';
import { isPassiveImageUrl } from '../../utils/passive-content';
import { resolveReviewedMediaPath } from '../../utils/reviewed-media-path';
import { isPreviewableImage } from '../../utils/file-type-utils';
import { Button } from '../ui/button';

const DocumentPathContext = createContext<string | undefined>(undefined);

/** Root feedback and guides omit documentPath; file content supplies its reviewed path. */
export function ReviewedMedia({
  documentPath,
  children,
}: {
  documentPath?: string;
  children: React.ReactNode;
}) {
  return (
    <DocumentPathContext.Provider value={documentPath}>{children}</DocumentPathContext.Provider>
  );
}

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> &
  ExtraProps & {
    'data-reviewed-image-source'?: string;
  };
type ImageState = { request: object; url?: string; failed?: boolean };

/** Only passive URLs reach an img. Reviewed paths go through the host's snapshot reader. */
export function ReviewedImage({
  src,
  alt,
  title,
  width,
  height,
  className,
  lang,
  dir,
  'data-reviewed-image-source': reference,
}: ImageProps) {
  const props = {
    src,
    alt,
    title,
    width,
    height,
    className,
    lang,
    dir,
    'data-reviewed-image-source': reference,
  };
  const store = useContext(SessionStoreContext);
  return store ? (
    <ModernReviewedImage {...props} store={store} />
  ) : (
    <LegacyReviewedImage {...props} />
  );
}

const ModernReviewedImage = memo(function ModernReviewedImage({
  store,
  ...props
}: ImageProps & { store: ReviewSessionStore }) {
  const read = () => store.getSnapshot().allDiffFiles;
  const files = useSyncExternalStore(store.subscribe, read, read);
  const snapshot = useOptionalSnapshotKey();
  return <ReviewedImageContent {...props} files={files} snapshot={snapshot} />;
});

function LegacyReviewedImage(props: ImageProps) {
  const review = useContext(ReviewContext);
  const snapshot = review ? `${review.sessionId}:${review.snapshotId ?? ''}` : '';
  return <ReviewedImageContent {...props} files={review?.diffFiles} snapshot={snapshot} />;
}

function ReviewedImageContent({
  src,
  alt,
  title,
  width,
  height,
  className,
  lang,
  dir,
  'data-reviewed-image-source': reference,
  files,
  snapshot,
}: ImageProps & { files?: DiffFile[]; snapshot: string }) {
  const { t } = useLocalization();
  const adapter = useAdapter();
  const documentPath = useContext(DocumentPathContext);
  const [attempt, setAttempt] = useState(0);
  const directUrl = typeof src === 'string' && isPassiveImageUrl(src) ? src : undefined;
  const path = reference ? resolveReviewedMediaPath(reference, documentPath) : null;
  const supported = !!(adapter?.reads?.loadImage || adapter?.loadImage);
  // Duplicate display paths may name different sides/entries. Never guess which was intended.
  const admitted =
    path &&
    isPreviewableImage(path) &&
    files?.filter(file => file.newPath === path || file.oldPath === path).length === 1;
  const request = useMemo(() => ({}), [adapter, snapshot, files, path, directUrl, attempt]);
  const [state, setState] = useState<ImageState | null>(null);
  const current = state?.request === request ? state : null;

  useEffect(() => {
    if (directUrl || !path || !admitted || !supported) return;
    const controller = new AbortController();
    void loadImage(adapter, path, controller.signal).then(
      result => {
        if (controller.signal.aborted) return;
        setState({
          request,
          ...(result &&
          typeof result === 'object' &&
          'dataUri' in result &&
          typeof result.dataUri === 'string' &&
          isPassiveImageUrl(result.dataUri)
            ? { url: result.dataUri }
            : { failed: true }),
        });
      },
      () => {
        if (!controller.signal.aborted) setState({ request, failed: true });
      }
    );
    return () => controller.abort();
  }, [adapter, path, admitted, supported, directUrl, request]);

  const failed = current?.failed || (!directUrl && (!admitted || !supported));
  const url = current?.failed ? undefined : (directUrl ?? current?.url);
  if (url)
    return (
      <img
        src={url}
        alt={alt}
        title={title}
        width={width}
        height={height}
        className={className}
        lang={lang}
        dir={dir}
        onError={() => setState({ request, failed: true })}
      />
    );
  if (!failed)
    return (
      <span role='status' aria-label={t('Loading image...')}>
        {alt || t('Loading image...')}
      </span>
    );
  return (
    <span role='alert' aria-label={t('Image preview unavailable')} title={title}>
      {alt && <span>{alt}: </span>}
      {t(
        !supported && !directUrl
          ? 'Image loading not supported in this context.'
          : 'Failed to load image.'
      )}
      {admitted && supported && (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => {
            setState(null);
            setAttempt(value => value + 1);
          }}
        >
          {t('Retry')}
        </Button>
      )}
    </span>
  );
}
