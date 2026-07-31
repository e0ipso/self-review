---
id: 2
group: "version-check"
dependencies: [1]
status: "completed"
created: "2026-02-27"
skills:
  - react-components
---
# Implement UpdateBanner component and integrate in App.tsx

## Objective
Create a dismissible update banner that appears at the top of the app when a newer version is detected, and integrate it into the app layout.

## Skills Required
- React components with shadcn/ui, Tailwind CSS, lucide-react icons

## Acceptance Criteria
- [ ] New file `src/renderer/components/UpdateBanner.tsx` renders a thin banner above the toolbar
- [ ] Banner listens for version update info via `window.electronAPI.onVersionUpdate`
- [ ] Banner displays: "Self Review v{latestVersion} is available" with a clickable link
- [ ] Clicking the link opens the release URL in the user's default browser via `window.electronAPI.openExternal`
- [ ] Banner has a dismiss (X) button that hides it for the session (React state, no persistence)
- [ ] Banner is only rendered when update info is present and not dismissed
- [ ] Banner uses shadcn/ui components and lucide-react icons, matching app styling conventions
- [ ] `App.tsx` renders `<UpdateBanner />` above `<Toolbar />` in `AppContent`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Use shadcn/ui `Button` for the dismiss button
- Use lucide-react icon (e.g., `ArrowUpCircle` or `Download`) for visual cue
- Use lucide-react `X` for dismiss
- Banner should use Tailwind classes consistent with the existing toolbar styling (`h-8`, `px-3`, `border-b`, `border-border`, `bg-background`, `text-xs`)
- Use a distinct but subtle background color to differentiate from the toolbar (e.g., `bg-blue-50 dark:bg-blue-950` or similar)
- The link should be styled as a clickable text link, not a full button

## Input Dependencies
- Task 1 provides: `VersionUpdateInfo` type, `onVersionUpdate` and `openExternal` in `ElectronAPI`

## Output Artifacts
- `src/renderer/components/UpdateBanner.tsx` — new component
- Updated `src/renderer/App.tsx` — renders UpdateBanner

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. Create `src/renderer/components/UpdateBanner.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ArrowUpCircle, X } from 'lucide-react';
import { VersionUpdateInfo } from '../../shared/types';

export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<VersionUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.electronAPI.onVersionUpdate((info) => {
      setUpdateInfo(info);
    });
  }, []);

  if (!updateInfo || dismissed) return null;

  return (
    <div
      className="flex items-center justify-between h-8 px-3 border-b border-border bg-blue-50 dark:bg-blue-950 text-xs"
      data-testid="update-banner"
    >
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span>
          Self Review v{updateInfo.latestVersion} is available.{' '}
          <button
            className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
            onClick={() => window.electronAPI.openExternal(updateInfo.releaseUrl)}
          >
            View release
          </button>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setDismissed(true)}
        data-testid="update-banner-dismiss"
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
```

Key points:
- `useEffect` registers the IPC listener once on mount.
- State is entirely React-managed (no persistence across sessions).
- Uses a `<button>` element for the link text with `onClick` calling `openExternal` — not an `<a>` tag (since we can't use `target="_blank"` in Electron safely).
- Uses shadcn `Button` for the dismiss X.

### 2. Update `src/renderer/App.tsx`

Import `UpdateBanner`:
```typescript
import UpdateBanner from './components/UpdateBanner';
```

In the `AppContent` JSX, add `<UpdateBanner />` above `<Toolbar />`:
```tsx
<div className='flex flex-col h-screen bg-background text-foreground antialiased'>
  <UpdateBanner />
  <Toolbar />
  <Layout />
</div>
```

This places the banner at the very top of the window. When no update is available (or dismissed), the component returns `null` and takes no space.

</details>
