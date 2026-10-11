/**
 * Global native sharing utility with clipboard fallback.
 * Uses the Web Share API (Windows native share, macOS share sheet, Linux, mobile).
 * If unsupported or denied, falls back to copying the link to clipboard.
 */

export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled';

export async function shareOrCopy(options: ShareOptions): Promise<ShareResult> {
  const { title, text, url } = options;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const shareData: ShareData = {
        title: title || 'IntellMeet',
        text: text || `Join the meeting: ${url}`,
        url,
      };

      if (!navigator.canShare || navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return 'shared';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
      // If native share encountered an error, proceed to fallback clipboard copy
    }
  }

  // Fallback to clipboard
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    return 'copied';
  } catch {
    return 'cancelled';
  }
}
