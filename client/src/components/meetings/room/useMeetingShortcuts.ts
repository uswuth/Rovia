import { useEffect } from 'react';

export function useMeetingShortcuts({
  onToggleMic,
  onToggleCamera,
  onToggleSpeaker,
  onMuteAllThree,
}: {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onMuteAllThree: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const isKeyC = event.code === 'KeyC' || event.key.toLowerCase() === 'c';
        const isKeyV = event.code === 'KeyV' || event.key.toLowerCase() === 'v';
        const isKeyB = event.code === 'KeyB' || event.key.toLowerCase() === 'b';
        const isKeyN = event.code === 'KeyN' || event.key.toLowerCase() === 'n';

        if (isKeyC) {
          event.preventDefault();
          onToggleMic();
        } else if (isKeyV) {
          event.preventDefault();
          onToggleCamera();
        } else if (isKeyB) {
          event.preventDefault();
          onToggleSpeaker();
        } else if (isKeyN) {
          event.preventDefault();
          onMuteAllThree();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMic, onToggleCamera, onToggleSpeaker, onMuteAllThree]);
}
