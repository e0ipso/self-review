import React, { createContext, useContext, useState, type ReactNode } from 'react';

/** The owner returns only after expanded geometry and interactivity have committed. */
type ExpandFileTree = () => boolean;
function createFileTreeExpansion() {
  let owner: ExpandFileTree | null = null;
  return {
    register(expand: ExpandFileTree) {
      owner = expand;
      return () => {
        if (owner === expand) owner = null;
      };
    },
    /** Undefined means a custom composition has no registered layout. */
    expand: (): boolean | undefined => owner?.(),
  };
}
const FileTreeExpansionContext = createContext<ReturnType<typeof createFileTreeExpansion> | null>(
  null
);
export function FileTreeExpansionProvider({ children }: { children: ReactNode }) {
  const [operation] = useState(createFileTreeExpansion);
  return (
    <FileTreeExpansionContext.Provider value={operation}>
      {children}
    </FileTreeExpansionContext.Provider>
  );
}
export const useFileTreeExpansion = () => useContext(FileTreeExpansionContext);
