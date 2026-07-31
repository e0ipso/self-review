---
id: 3
group: 'renderer'
dependencies: [1]
status: 'completed'
created: '2026-02-12'
skills:
  - react-components
---

# Add close confirmation dialog and update Finish Review button

## Objective

Create a shadcn/ui AlertDialog component that appears when the user closes the window via the X button (or Cmd+Q/Alt+F4). The dialog offers three choices: Save & Quit, Discard, and Cancel. Also update the Finish Review toolbar button to call `saveAndQuit()` directly instead of `window.close()`.

## Skills Required

React components with shadcn/ui (Radix-based AlertDialog). Understanding of the Electron preload bridge pattern for IPC calls.

## Acceptance Criteria

- [ ] shadcn/ui `alert-dialog` component is installed (`npx shadcn@latest add alert-dialog`)
- [ ] New `CloseConfirmDialog` component in `src/renderer/components/CloseConfirmDialog.tsx`
- [ ] Dialog listens for `app:close-requested` via `window.electronAPI.onCloseRequested()`
- [ ] Dialog title: "Save your review?"
- [ ] Dialog description: "You have unsaved review work. What would you like to do?"
- [ ] "Save & Quit" button (primary) calls `window.electronAPI.saveAndQuit()`
- [ ] "Discard" button (destructive variant) calls `window.electronAPI.discardAndQuit()`
- [ ] "Cancel" button closes the dialog
- [ ] `CloseConfirmDialog` is mounted in `App.tsx`
- [ ] Finish Review button in `Toolbar.tsx` calls `window.electronAPI.saveAndQuit()` instead of `window.close()`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- React, shadcn/ui AlertDialog (Radix primitive)
- `window.electronAPI` preload bridge (from Task 1)
- Existing Toolbar component pattern

## Input Dependencies

- Task 1: `ElectronAPI` type with `onCloseRequested`, `saveAndQuit`, `discardAndQuit`; preload bridge exposing these methods

## Output Artifacts

- New `src/renderer/components/ui/alert-dialog.tsx` (shadcn/ui generated)
- New `src/renderer/components/CloseConfirmDialog.tsx`
- Updated `src/renderer/App.tsx`
- Updated `src/renderer/components/Toolbar.tsx`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. Install shadcn/ui alert-dialog

Run from the project root:

```bash
npx shadcn@latest add alert-dialog
```

This creates `src/renderer/components/ui/alert-dialog.tsx`. The project already uses shadcn/ui (there are existing `ui/` components like `button.tsx`, `tooltip.tsx`, etc.), so the configuration is already in place.

### 2. Create `src/renderer/components/CloseConfirmDialog.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export default function CloseConfirmDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.electronAPI.onCloseRequested(() => {
      setOpen(true);
    });
  }, []);

  const handleSaveAndQuit = () => {
    window.electronAPI.saveAndQuit();
  };

  const handleDiscard = () => {
    window.electronAPI.discardAndQuit();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your review?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved review work. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDiscard}
          >
            Discard
          </AlertDialogAction>
          <AlertDialogAction onClick={handleSaveAndQuit}>
            Save & Quit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Notes on AlertDialogAction**:
- The shadcn/ui `AlertDialogAction` may not accept a `variant` prop directly. If not, use the `className` approach: `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"` for the Discard button.
- The default `AlertDialogAction` styling should work for "Save & Quit" as the primary action.
- `AlertDialogCancel` automatically closes the dialog (sets `open` to `false`).
- The Discard `AlertDialogAction` will also auto-close the dialog, but the `discardAndQuit()` call will destroy the window before that matters.

**Important**: The `onCloseRequested` callback registers an `ipcRenderer.on` listener. In a strict setup, you'd want to clean up the listener on unmount. However, since this component is always mounted (in App.tsx) and the app lifecycle is one-shot, cleanup is not necessary. If you want to be thorough, you could return a cleanup function from the preload method, but this is optional.

### 3. Update `src/renderer/App.tsx`

Import and mount `CloseConfirmDialog` inside the existing component tree. Place it outside the main layout but inside the providers:

```tsx
import CloseConfirmDialog from './components/CloseConfirmDialog';

export default function App() {
  return (
    <ConfigProvider>
      <ReviewProvider>
        <TooltipProvider>
          <div className='flex flex-col h-screen bg-background text-foreground antialiased'>
            <Toolbar />
            <Layout />
          </div>
          <CloseConfirmDialog />
        </TooltipProvider>
      </ReviewProvider>
    </ConfigProvider>
  );
}
```

The dialog is always mounted. Its visibility is controlled by the `open` state, which is only set to `true` when `app:close-requested` is received.

### 4. Update `src/renderer/components/Toolbar.tsx`

Find the Finish Review button (around line 272-281). Change the `onClick` handler:

**Before:**
```tsx
onClick={() => window.close()}
```

**After:**
```tsx
onClick={() => window.electronAPI.saveAndQuit()}
```

No other changes to Toolbar.tsx.

### Testing

- Unit testing React components that depend on `window.electronAPI` requires mocking. This is low-value for a dialog component. The E2E tests (Task 5) will exercise this flow.
- Verify the component renders without errors by building: `npm run build` or running the renderer test suite.

</details>
