import React, { useState } from 'react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';

export default function WelcomeScreen() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="welcome-screen"
      className="flex items-center justify-center h-full bg-background"
    >
      <div className="w-full max-w-lg space-y-6 p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">self-review</h1>
          <p className="text-muted-foreground">
            Review code locally with a GitHub-style PR interface
          </p>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
