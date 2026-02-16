import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';

function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" ry="96" fill="url(#bg)" />
      <rect x="60" y="144" width="392" height="56" rx="12" fill="#dc2626" opacity="0.2" />
      <rect x="78" y="168" width="20" height="6" rx="3" fill="#f87171" />
      <rect x="120" y="164" width="140" height="20" rx="6" fill="#f87171" opacity="0.8" />
      <rect x="276" y="164" width="80" height="20" rx="6" fill="#f87171" opacity="0.5" />
      <rect x="120" y="228" width="100" height="16" rx="5" fill="#94a3b8" opacity="0.35" />
      <rect x="236" y="228" width="60" height="16" rx="5" fill="#94a3b8" opacity="0.25" />
      <rect x="60" y="268" width="392" height="56" rx="12" fill="#16a34a" opacity="0.2" />
      <rect x="78" y="293" width="20" height="6" rx="3" fill="#4ade80" />
      <rect x="85" y="286" width="6" height="20" rx="3" fill="#4ade80" />
      <rect x="120" y="288" width="172" height="20" rx="6" fill="#4ade80" opacity="0.8" />
      <rect x="308" y="288" width="64" height="20" rx="6" fill="#4ade80" opacity="0.5" />
      <rect x="120" y="352" width="80" height="16" rx="5" fill="#94a3b8" opacity="0.35" />
      <circle cx="400" cy="400" r="56" fill="#0f172a" opacity="0.6" />
      <circle cx="400" cy="400" r="48" fill="#22c55e" />
      <polyline
        points="378,400 394,416 424,384"
        fill="none"
        stroke="#fff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WelcomeScreen() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return window.electronAPI.onCloseRequested(() => {
      window.electronAPI.discardAndQuit();
    });
  }, []);

  const handleBrowse = async () => {
    const path = await window.electronAPI.pickDirectory();
    if (path) {
      setSelectedPath(path);
    }
  };

  const handleStartReview = async () => {
    if (!selectedPath) return;
    setLoading(true);
    try {
      await window.electronAPI.startDirectoryReview(selectedPath);
    } catch (err) {
      console.error('[WelcomeScreen] Failed to start directory review:', err);
      setError(err instanceof Error ? err.message : 'Failed to start review');
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="welcome-screen"
      className="flex items-center justify-center h-full bg-background"
    >
      <div className="w-full max-w-lg space-y-6 p-6">
        <div className="text-center space-y-4">
          <Logo className="w-20 h-20 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">self-review</h1>
            <p className="text-muted-foreground">
              GitHub-style PR review UI for local git diffs. Designed for solo
              developers reviewing AI-generated code.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Git Mode</CardTitle>
            <CardDescription>
              Runs git diff to show actual changes in your repository
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Launch from the CLI with diff arguments to use this mode.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Directory Mode</CardTitle>
            <CardDescription>
              Shows all files as new additions — useful for reviewing generated
              code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                data-testid="browse-button"
                variant="outline"
                onClick={handleBrowse}
                disabled={loading}
              >
                Browse...
              </Button>
              {selectedPath && (
                <span
                  data-testid="directory-path"
                  className="text-sm text-muted-foreground truncate"
                  title={selectedPath}
                >
                  {selectedPath}
                </span>
              )}
            </div>
            {selectedPath && (
              <Button
                onClick={handleStartReview}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Loading...' : 'Start Review'}
              </Button>
            )}
            {error && (
              <p
                data-testid="welcome-error"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              If the selected directory is a git repository, git mode will be
              used automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
