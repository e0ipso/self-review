import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { HintOverlay } from './HintOverlay';

export function KeyboardNavigationManager() {
  const { hints, inputBuffer } = useKeyboardNavigation();
  return <HintOverlay hints={hints} inputBuffer={inputBuffer} />;
}
