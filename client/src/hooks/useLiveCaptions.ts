import { useEffect, useRef, useState, useCallback } from 'react';
import { getMeetingSocket } from '@/api/meeting/meeting-socket';
import '../types/speech.d.ts';

export interface LiveCaptionItem {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface UseLiveCaptionsOptions {
  meetingId: string;
  currentUserId?: string;
  currentUserName?: string;
  micOn?: boolean;
}

/**
 * Modern real-time speech-to-text hook (Google Meet & Zoom style).
 * Uses Browser SpeechRecognition API to transcribe live speech without requiring
 * raw audio file recording/uploading to object storage.
 * Broadcasts captions across the socket room so all participants see live subtitles
 * and automatically saves the conversation for instant AI summarization upon meeting end.
 */
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export const useLiveCaptions = ({
  meetingId,
  currentUserId,
  currentUserName,
  micOn = true,
}: UseLiveCaptionsOptions) => {
  const [captionsEnabled, setCaptionsEnabled] = useState(() => {
    const SpeechRecClass = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    return Boolean(SpeechRecClass);
  });
  const [activeCaption, setActiveCaption] = useState<LiveCaptionItem | null>(null);
  const [captionHistory, setCaptionHistory] = useState<LiveCaptionItem[]>([]);
  const [isSupported, setIsSupported] = useState(() => {
    return typeof window !== 'undefined'
      ? Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
      : false;
  });
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(true);
  const clearTimerRef = useRef<number | null>(null);
  const micOnRef = useRef(micOn);
  const isFatalErrorRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const activeUtteranceIdRef = useRef<string>('turn-initial');
  const lastSpeakerIdRef = useRef<string>('');
  const lastFinalTimestampRef = useRef<number>(0);
  const accumulatedFinalRef = useRef<string>('');

  const currentUserIdRef = useRef(currentUserId);
  const currentUserNameRef = useRef(currentUserName);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
    currentUserNameRef.current = currentUserName;
  }, [currentUserId, currentUserName]);

  // Manage speech recognition start/stop based on microphone state
  useEffect(() => {
    micOnRef.current = micOn;
    const recognition = recognitionRef.current;
    if (!recognition || isFatalErrorRef.current) return;

    // Clear any pending retry timer when mic state changes
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (micOn) {
      shouldListenRef.current = true;
      try {
        recognition.start();
      } catch {
        // Recognition already started or starting
      }
    } else {
      shouldListenRef.current = false;
      try {
        recognition.stop();
      } catch {
        // Already stopped
      }
    }
  }, [micOn]);

  // Listen to remote participant captions broadcasted through socket
  useEffect(() => {
    if (!meetingId) return;

    const socket = getMeetingSocket();
    const handleRemoteCaption = (caption: LiveCaptionItem) => {
      setActiveCaption(caption);

      if (caption.isFinal && caption.text.trim()) {
        setCaptionHistory((prev) => {
          const lastIndex = prev.length - 1;
          const last = prev[lastIndex];

          // If same speaker within 4 seconds, append to the same paragraph instead of creating a new line
          if (last && last.speakerId === caption.speakerId && (caption.timestamp - last.timestamp) < 4000) {
            const mergedText = `${last.text.replace(/[.,!?]+$/, '')}. ${caption.text}`;
            const merged: LiveCaptionItem = {
              ...last,
              id: caption.id,
              text: mergedText,
              timestamp: caption.timestamp,
            };
            const updated = [...prev.slice(0, lastIndex), merged];
            try {
              sessionStorage.setItem(`intellmeet_transcript_${meetingId}`, JSON.stringify(updated));
            } catch {
              // Ignore
            }
            return updated;
          }

          const updated = [...prev, caption];
          try {
            sessionStorage.setItem(`intellmeet_transcript_${meetingId}`, JSON.stringify(updated));
          } catch {
            // Ignore quota errors
          }
          return updated;
        });
      }

      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => {
        setActiveCaption((prev) => (prev?.id === caption.id ? null : prev));
      }, 4000);
    };

    socket.on('meeting:caption', handleRemoteCaption as never);

    return () => {
      socket.off('meeting:caption', handleRemoteCaption as never);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, [meetingId]);

  // Handle local microphone speech recognition
  useEffect(() => {
    if (!meetingId) return;

    const SpeechRecClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecClass) {
      console.warn('SpeechRecognition API is not supported in this browser.');
      return;
    }

    let recognition: SpeechRecognitionInstance | null = null;
    try {
      const recInstance = new SpeechRecClass() as SpeechRecognitionInstance;
      recInstance.continuous = true;
      recInstance.interimResults = true;
      recInstance.lang = navigator.language || 'en-US';
      recInstance.maxAlternatives = 1;
      recognitionRef.current = recInstance;
      recognition = recInstance;
    } catch (e) {
      console.warn('Failed to initialize SpeechRecognition:', e);
      return;
    }

    const rec = recognition;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let isFinalEvent = false;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const piece = item[0]?.transcript || '';
        if (item.isFinal) {
          accumulatedFinalRef.current = (accumulatedFinalRef.current ? `${accumulatedFinalRef.current} ` : '') + piece.trim();
          isFinalEvent = true;
        } else {
          interimTranscript += piece;
        }
      }

      const activeText = (
        accumulatedFinalRef.current + (interimTranscript ? ` ${interimTranscript}` : '')
      ).trim();

      if (!activeText) return;

      const speakerId = currentUserIdRef.current || 'me';
      const speakerName = currentUserNameRef.current || 'You';

      const captionItem: LiveCaptionItem = {
        id: activeUtteranceIdRef.current,
        speakerId,
        speakerName,
        text: activeText,
        isFinal: isFinalEvent,
        timestamp: Date.now(),
      };

      // Set locally
      setActiveCaption(captionItem);

      if (isFinalEvent) {
        const now = Date.now();
        const sameSpeakerRecent =
          lastSpeakerIdRef.current === speakerId &&
          (now - lastFinalTimestampRef.current) < 4000;

        setCaptionHistory((prev) => {
          if (sameSpeakerRecent && prev.length > 0) {
            const lastIndex = prev.length - 1;
            const last = prev[lastIndex];
            if (last && last.speakerId === speakerId) {
              const mergedText = `${last.text.replace(/[.,!?]+$/, '')}. ${captionItem.text}`;
              const merged: LiveCaptionItem = {
                ...last,
                id: captionItem.id,
                text: mergedText,
                timestamp: now,
              };
              const updated = [...prev.slice(0, lastIndex), merged];
              try {
                sessionStorage.setItem(`intellmeet_transcript_${meetingId}`, JSON.stringify(updated));
              } catch {
                // Ignore
              }
              return updated;
            }
          }

          const updated = [...prev, captionItem];
          try {
            sessionStorage.setItem(`intellmeet_transcript_${meetingId}`, JSON.stringify(updated));
          } catch {
            // Ignore
          }
          return updated;
        });

        lastSpeakerIdRef.current = speakerId;
        lastFinalTimestampRef.current = now;

        // Reset buffer and cycle ID for next natural utterance
        accumulatedFinalRef.current = '';
        activeUtteranceIdRef.current = `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }

      // Broadcast to room
      const socket = getMeetingSocket();
      socket.emit('meeting:caption', {
        meetingId,
        ...captionItem,
      });

      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => {
        setActiveCaption((prev) => (prev?.id === captionItem.id ? null : prev));
      }, isFinalEvent ? 4000 : 7000);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' or 'aborted' are normal lifecycle events
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('SpeechRecognition error:', event.error);
        setRecognitionError(event.error);
      }

      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        // Permissions or service blocked — permanent for this session
        isFatalErrorRef.current = true;
        shouldListenRef.current = false;
        setIsSupported(false);
        setCaptionsEnabled(false);
        try {
          recognition.stop();
        } catch {
          // Ignore
        }
      } else if (event.error === 'network') {
        // Network errors are recoverable (ad blockers, proxy, temporary outage) —
        // stop and retry with exponential backoff instead of permanently giving up.
        shouldListenRef.current = false;
        try {
          recognition.stop();
        } catch {
          // Ignore
        }
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        retryCountRef.current += 1;
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null;
          if (!isFatalErrorRef.current && micOnRef.current) {
            shouldListenRef.current = true;
            setRecognitionError(null);
            try {
              recognition.start();
            } catch {
              // Ignore rapid restart collisions
            }
          }
        }, delay);
      }
    };

    recognition.onstart = () => {
      // Reset retry backoff once recognition successfully starts
      retryCountRef.current = 0;
    };

    recognition.onend = () => {
      // Auto-reconnect so long as meeting is active and listening is wanted and no fatal error occurred
      if (shouldListenRef.current && !isFatalErrorRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore rapid restart collisions
        }
      }
    };

    shouldListenRef.current = micOnRef.current && !isFatalErrorRef.current;
    if (micOnRef.current && !isFatalErrorRef.current) {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Could not auto-start SpeechRecognition:', err);
      }
    }

    return () => {
      shouldListenRef.current = false;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      try {
        recognition.stop();
      } catch {
        // Ignore
      }
    };
  }, [meetingId]);

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => !prev);
  }, []);

  return {
    captionsEnabled,
    toggleCaptions,
    activeCaption: captionsEnabled ? activeCaption : null,
    captionHistory,
    isSupported,
    recognitionError,
  };
};

