---
id: 6
group: "renderer"
dependencies: [1, 5]
status: "completed"
created: "2026-02-16"
skills:
  - react-components
  - electron
---

# Create Welcome Screen Component

## Objective

Build the `WelcomeScreen.tsx` React component with directory picker, mode explanation, and install required shadcn/ui components (Card, RadioGroup, Label). Integrate into `App.tsx` so it displays when `source.type === 'welcome'`.

## Skills Required

- React component development with shadcn/ui, Electron IPC

## Acceptance Criteria

- [ ] shadcn/ui Card, RadioGroup, and Label components are installed
- [ ] `src/renderer/components/WelcomeScreen.tsx` exists and renders a directory picker UI
- [ ] Component uses Card for layout panels, RadioGroup for mode selection, Button to trigger picker
- [ ] Informational text explains the difference between git mode and directory mode
- [ ] Clicking "Browse" triggers `electronAPI.pickDirectory()` via preload bridge
- [ ] After directory selection, the app transitions from welcome screen to review UI
- [ ] `App.tsx` conditionally renders `WelcomeScreen` when `source.type === 'welcome'`
- [ ] Welcome screen has appropriate `data-testid` attributes for e2e testing
- [ ] Component follows existing styling patterns (shadcn/ui, Tailwind)

## Technical Requirements

- Install shadcn components: `npx shadcn@latest add card radio-group label`
- Use `electronAPI.pickDirectory()` (added in Task 5) to open the native directory dialog
- After a directory is picked, call a method that triggers main process to scan and send `diff:load`
- Use `data-testid="welcome-screen"`, `data-testid="browse-button"`, `data-testid="directory-path"` for testability

## Input Dependencies

- Task 1: `DiffSource` type to check `source.type === 'welcome'`
- Task 5: `pickDirectory()` IPC method must be available in preload bridge

## Output Artifacts

- New shadcn/ui component files in `src/renderer/components/ui/` (card, radio-group, label)
- New `src/renderer/components/WelcomeScreen.tsx`
- Updated `src/renderer/App.tsx` with conditional rendering

## Implementation Notes

<details>

1. **Install shadcn components** (run from project root):
   ```bash
   npx shadcn@latest add card radio-group label
   ```

2. **Create `src/renderer/components/WelcomeScreen.tsx`**:
   ```tsx
   import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
   import { RadioGroup, RadioGroupItem } from './ui/radio-group';
   import { Label } from './ui/label';
   import { Button } from './ui/button';

   export function WelcomeScreen() {
     const handleBrowse = async () => {
       const dirPath = await window.electronAPI.pickDirectory();
       if (dirPath) {
         // Trigger main process to scan and load
         // This might call another IPC method to start the review
       }
     };

     return (
       <div data-testid="welcome-screen" className="flex items-center justify-center h-full">
         <Card className="w-[500px]">
           <CardHeader>
             <CardTitle>Welcome to Self-Review</CardTitle>
             <CardDescription>Select a directory to review</CardDescription>
           </CardHeader>
           <CardContent>
             {/* Directory picker button */}
             {/* Mode explanation text */}
             {/* RadioGroup for git vs directory mode (if applicable) */}
             <Button data-testid="browse-button" onClick={handleBrowse}>
               Browse...
             </Button>
           </CardContent>
         </Card>
       </div>
     );
   }
   ```

3. **Update `App.tsx`**: Read `source` from `ReviewContext` or from the diff load payload. If `source.type === 'welcome'`, render `<WelcomeScreen />` instead of the review UI.

4. **Mode explanation text**: Include clear descriptions:
   - **Git Mode**: "Runs `git diff` to show actual changes in your repository"
   - **Directory Mode**: "Shows all files as new additions — useful for reviewing generated code"

5. **data-testid attributes**: Add to all interactive elements for e2e testing:
   - `welcome-screen` on the root container
   - `browse-button` on the browse button
   - `directory-path` on the path display (after selection)

6. **Transition flow**: After the user picks a directory and main process sends `diff:load`, the `source.type` in context will change from `'welcome'` to `'git'` or `'directory'`, causing `App.tsx` to re-render with the review UI.

</details>
