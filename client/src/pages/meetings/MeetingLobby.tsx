import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Video, VideoOff, Mic, MicOff, Clock, Calendar,
  ArrowRight, AlertCircle, ShieldCheck, RefreshCw, Share2, FolderGit2, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { IntellMeetLogo } from '@/components/ui/IntellMeetLogo';
import { useAuth } from '@/context/AuthContext';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { useProject } from '@/context/ProjectContext';
import { getProjectName, getProjectId } from '@/types/project.types';
import { previewMeetingByJoinCode } from '@/api/meeting/meeting.api';
import type { MeetingPreview } from '@/api/meeting/meeting.types';
import { parseApiError } from '@/utils/apiError';
import { formatCountdown } from '@/lib/format-countdown';

const getCleanDeviceLabel = (
  device: MediaDeviceInfo | undefined,
  type: 'Camera' | 'Microphone' | 'Speaker',
  index: number
): string => {
  if (!device) return `Select ${type}`;
  if (device.label && device.label.trim()) return device.label.trim();
  if (device.deviceId === 'default') return `Default ${type}`;
  return `${type} ${index >= 0 ? index + 1 : 1}`;
};

export const MeetingLobby: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { formatDateTimeStr } = useTimeFormat();
  const { projects } = useProject();

  const [preview, setPreview] = useState<MeetingPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time state for countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // Media states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Device selectors
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Native share or copy link
  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: preview?.meetingTitle || 'IntellMeet Meeting',
          text: `Join IntellMeet video meeting: ${preview?.meetingTitle || ''}`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // Enumerate audio & video devices
  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      const speakers = devices.filter((d) => d.kind === 'audiooutput');
      const cameras = devices.filter((d) => d.kind === 'videoinput');

      setAudioInputs(mics);
      setAudioOutputs(speakers);
      setVideoInputs(cameras);

      if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
      if (speakers.length > 0 && !selectedSpeaker) setSelectedSpeaker(speakers[0].deviceId);
      if (cameras.length > 0 && !selectedCamera) setSelectedCamera(cameras[0].deviceId);
    } catch {
      // Ignore device enumeration errors
    }
  };

  // Auto-redirect unauthenticated users to login page with saved return URL
  useEffect(() => {
    if (!isAuthenticated && code) {
      const returnPath = `/meetings/join/${code}`;
      sessionStorage.setItem('intellmeet_redirect_url', returnPath);
      navigate('/login', { state: { from: returnPath }, replace: true });
    }
  }, [isAuthenticated, code, navigate]);

  useEffect(() => {
    let mounted = true;
    const fetchPreview = async () => {
      if (!code) {
        setError('No join code provided');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await previewMeetingByJoinCode(code);
        if (mounted) {
          setPreview(res.data.data);
        }
      } catch (err) {
        if (mounted) {
          setError(parseApiError(err).message || 'Failed to find meeting');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPreview();
    return () => {
      mounted = false;
    };
  }, [code]);

  // Start media stream
  const startMedia = async (micId?: string, camId?: string) => {
    try {
      setMediaPermissionDenied(false);

      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const audioConstraint: boolean | MediaTrackConstraints = micId
        ? { deviceId: { exact: micId } }
        : true;
      const videoConstraint: boolean | MediaTrackConstraints = camId
        ? { deviceId: { exact: camId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

      const userMedia = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint,
      });

      setStream(userMedia);
      if (videoRef.current) {
        videoRef.current.srcObject = userMedia;
      }

      void refreshDevices();

      // Audio volume meter
      try {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          void audioContextRef.current.close();
        }
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(userMedia);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch {
        // Fallback
      }
    } catch {
      setMediaPermissionDenied(true);
    }
  };

  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void startMedia();
    }, 0);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = cameraEnabled ? stream : null;
    }
  }, [stream, cameraEnabled]);

  const toggleCamera = () => {
    if (!stream) {
      void startMedia(selectedMic, selectedCamera);
      return;
    }
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !cameraEnabled;
      setCameraEnabled(!cameraEnabled);
    }
  };

  const toggleMic = () => {
    if (!stream) {
      void startMedia(selectedMic, selectedCamera);
      return;
    }
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micEnabled;
      setMicEnabled(!micEnabled);
    }
  };

  const handleJoin = () => {
    if (!preview) return;

    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/meetings/join/${code}` } });
      return;
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    navigate(`/meetings/${preview.meetingId}/room`, {
      state: {
        fromLobby: true,
        initialCamera: cameraEnabled,
        initialMic: micEnabled,
        preview,
      },
    });
  };

  const displayName = isAuthenticated ? (user?.userName || 'Member') : 'Member';

  // Match project title if available
  const activeProjectName = useMemo(() => {
    if (!preview || !projects) return null;
    const pId = (preview as unknown as Record<string, unknown>).projectId as string | undefined;
    if (pId) {
      const match = projects.find((p) => getProjectId(p) === pId);
      if (match) return getProjectName(match);
    }
    return null;
  }, [preview, projects]);

  // Selected device display labels
  const selectedCameraDevice = useMemo(
    () => videoInputs.find((d) => d.deviceId === selectedCamera),
    [videoInputs, selectedCamera]
  );
  const selectedMicDevice = useMemo(
    () => audioInputs.find((d) => d.deviceId === selectedMic),
    [audioInputs, selectedMic]
  );
  const selectedSpeakerDevice = useMemo(
    () => audioOutputs.find((d) => d.deviceId === selectedSpeaker),
    [audioOutputs, selectedSpeaker]
  );

  const cameraTriggerLabel = getCleanDeviceLabel(
    selectedCameraDevice,
    'Camera',
    videoInputs.findIndex((d) => d.deviceId === selectedCamera)
  );
  const micTriggerLabel = getCleanDeviceLabel(
    selectedMicDevice,
    'Microphone',
    audioInputs.findIndex((d) => d.deviceId === selectedMic)
  );
  const speakerTriggerLabel = getCleanDeviceLabel(
    selectedSpeakerDevice,
    'Speaker',
    audioOutputs.findIndex((d) => d.deviceId === selectedSpeaker)
  );

  // Meeting opening / countdown status
  const scheduledDate = preview ? new Date(preview.meetingScheduledAt) : new Date();
  const scheduledMs = scheduledDate.getTime();
  const earlyJoinMs = !isNaN(scheduledMs) ? scheduledMs - 5 * 60 * 1000 : 0;
  const durationMinutes = preview?.meetingDurationMinutes || 30;
  const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;

  const isPastDuration = !isNaN(scheduledMs) && now > endMs;
  const isTooEarly = !isNaN(scheduledMs) && now < earlyJoinMs;
  const isEndedOrCancelled = preview?.meetingStatus === 'ENDED' || preview?.meetingStatus === 'CANCELLED' || isPastDuration;
  const canJoin = Boolean(preview) && !isEndedOrCancelled && !isTooEarly;

  let buttonText = 'Join Meeting';
  if (isEndedOrCancelled) {
    buttonText = 'Meeting Ended';
  } else if (isTooEarly) {
    buttonText = `Opens in ${formatCountdown(scheduledMs, now)}`;
  }

  const isUserAssignedToMeeting = useMemo(() => {
    if (!preview || !user) return true;
    const userObj = user as unknown as Record<string, unknown>;
    const userId = user.userId || (userObj._id as string);
    if (user.isSuperAdmin || user.userRole === 'SuperAdmin' || user.userRole === 'Admin') return true;
    if (preview.createdBy === userId) return true;
    const isParticipant = (preview.participants || []).some((p) => {
      const pObj = p as unknown as Record<string, unknown>;
      const pId = typeof p === 'object' && p !== null ? p.userId || pObj._id || pObj.id : p;
      return pId === userId;
    });
    return isParticipant;
  }, [preview, user]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-emerald-500/20">
      {/* Header bar */}
      <header className="flex h-14 items-center justify-between border-b border-border/80 px-6 bg-background">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <IntellMeetLogo size={24} />
            <span className="text-sm font-bold tracking-tight text-foreground">IntellMeet</span>
          </div>

          {activeProjectName && (
            <>
              <span className="text-border">/</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <FolderGit2 size={13} />
                <span>{activeProjectName}</span>
              </div>
            </>
          )}
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span>Signed in as <strong className="text-foreground font-bold">{user?.userName}</strong></span>
            <Badge tone="neutral" className="font-semibold text-[10px]">{user?.userRole}</Badge>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Have an account?</span>
            <Link to="/login" className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              Sign in
            </Link>
          </div>
        )}
      </header>

      {/* Main body */}
      <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-xs text-muted-foreground">Connecting to meeting lobby...</p>
          </div>
        ) : error || !preview ? (
          <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Cannot Join Meeting</h2>
              <p className="mt-1 text-xs text-muted-foreground">{error || 'Meeting not found or link has expired.'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Return to IntellMeet
            </Button>
          </div>
        ) : !isUserAssignedToMeeting ? (
          <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center shadow-xl">
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You are logged in as <span className="font-semibold text-foreground">{user?.userEmail}</span>, but you are not assigned to this meeting roster. Please contact your meeting host or organization admin for access.
              </p>
            </div>
            <Button onClick={() => navigate('/meetings')} className="w-full mt-2">
              Back to Meetings
            </Button>
          </div>
        ) : (
          <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-10 lg:grid-cols-12">
            {/* Left 7 cols: Video Preview & Device Controls */}
            <div className="flex flex-col gap-4 lg:col-span-7">
              <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-xl">
                {/* Live Video feed */}
                {cameraEnabled && !mediaPermissionDenied ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="size-full object-cover -scale-x-100"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center text-slate-300">
                    <div className="flex size-20 items-center justify-center rounded-full bg-slate-800 text-emerald-400 font-bold text-2xl border border-slate-700/80 shadow-md">
                      {displayName.charAt(0) || 'G'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{displayName}</p>
                      <p className="text-xs text-slate-400">
                        {mediaPermissionDenied ? 'Camera and mic permissions needed' : 'Camera is turned off'}
                      </p>
                    </div>

                    {mediaPermissionDenied && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void startMedia(selectedMic, selectedCamera)}
                        className="mt-2 h-7 border-slate-700 bg-slate-800 text-[11px] text-white hover:bg-slate-700"
                      >
                        <RefreshCw size={12} className="mr-1.5" />
                        Allow Camera & Mic
                      </Button>
                    )}
                  </div>
                )}

                {/* Floating circular buttons (Dock without outer container background) */}
                <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3 px-4">
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`flex size-11 items-center justify-center rounded-full transition-all shadow-md cursor-pointer ${
                      micEnabled
                        ? 'bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/30'
                    }`}
                    title={micEnabled ? 'Mute Mic' : 'Unmute Mic'}
                  >
                    {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                  </button>

                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`flex size-11 items-center justify-center rounded-full transition-all shadow-md cursor-pointer ${
                      cameraEnabled
                        ? 'bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/30'
                    }`}
                    title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                  >
                    {cameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                    className={`flex size-11 items-center justify-center rounded-full transition-all shadow-md cursor-pointer ${
                      showDeviceSettings
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                        : 'bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10'
                    }`}
                    title="Device Preferences"
                  >
                    <Settings2 size={18} />
                  </button>
                </div>

                {/* Name badge */}
                <div className="absolute top-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
                  {displayName}
                </div>

                {/* Audio meter */}
                {micEnabled && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 backdrop-blur-xs">
                    <span className="text-[10px] text-slate-300 font-medium">Mic</span>
                    <div className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-700">
                      <div className="h-full bg-emerald-400 transition-all duration-75" style={{ width: `${audioLevel}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Shadcn UI Select Device Preferences Panel */}
              {showDeviceSettings && (
                <div className="border-t border-b border-border/80 py-4 my-1 space-y-3 text-xs">
                  <div className="font-bold text-foreground flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                    <Settings2 size={13} className="text-emerald-500" />
                    <span>Audio & Video Devices</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Camera */}
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-medium text-muted-foreground block">Camera</label>
                      <Select
                        value={selectedCamera}
                        onValueChange={(val) => {
                          if (typeof val === 'string') {
                            setSelectedCamera(val);
                            void startMedia(selectedMic, val);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-9 rounded-md border-border bg-background px-3 text-xs text-foreground min-w-0" title={cameraTriggerLabel}>
                          <span className="truncate flex-1 text-left">{cameraTriggerLabel}</span>
                        </SelectTrigger>
                        <SelectContent className="w-[max-content] min-w-[260px] max-w-[400px] shadow-lg">
                          {videoInputs.map((d, idx) => {
                            const lbl = getCleanDeviceLabel(d, 'Camera', idx);
                            return (
                              <SelectItem key={d.deviceId} value={d.deviceId} title={lbl}>
                                <span className="truncate">{lbl}</span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Microphone */}
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-medium text-muted-foreground block">Microphone</label>
                      <Select
                        value={selectedMic}
                        onValueChange={(val) => {
                          if (typeof val === 'string') {
                            setSelectedMic(val);
                            void startMedia(val, selectedCamera);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-9 rounded-md border-border bg-background px-3 text-xs text-foreground min-w-0" title={micTriggerLabel}>
                          <span className="truncate flex-1 text-left">{micTriggerLabel}</span>
                        </SelectTrigger>
                        <SelectContent className="w-[max-content] min-w-[260px] max-w-[400px] shadow-lg">
                          {audioInputs.map((d, idx) => {
                            const lbl = getCleanDeviceLabel(d, 'Microphone', idx);
                            return (
                              <SelectItem key={d.deviceId} value={d.deviceId} title={lbl}>
                                <span className="truncate">{lbl}</span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Speaker */}
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-medium text-muted-foreground block">Speaker</label>
                      <Select
                        value={selectedSpeaker}
                        onValueChange={(val) => {
                          if (typeof val === 'string') setSelectedSpeaker(val);
                        }}
                      >
                        <SelectTrigger className="w-full h-9 rounded-md border-border bg-background px-3 text-xs text-foreground min-w-0" title={speakerTriggerLabel}>
                          <span className="truncate flex-1 text-left">{speakerTriggerLabel}</span>
                        </SelectTrigger>
                        <SelectContent className="w-[max-content] min-w-[260px] max-w-[400px] shadow-lg">
                          {audioOutputs.length > 0 ? (
                            audioOutputs.map((d, idx) => {
                              const lbl = getCleanDeviceLabel(d, 'Speaker', idx);
                              return (
                                <SelectItem key={d.deviceId} value={d.deviceId} title={lbl}>
                                  <span className="truncate">{lbl}</span>
                                </SelectItem>
                              );
                            })
                          ) : (
                            <SelectItem value="default">Default Speaker</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span>Devices previewed locally before entering.</span>
              </div>
            </div>

            {/* Right 5 cols: Clean Minimal Layout with Balanced Radii */}
            <div className="flex flex-col gap-5 lg:col-span-5 py-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Meeting Session
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="gap-1.5 text-xs border-border hover:bg-secondary cursor-pointer rounded-md"
                  >
                    <Share2 size={13} />
                    <span>{copied ? 'Copied' : 'Share'}</span>
                  </Button>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-foreground leading-snug">
                  {preview.meetingTitle}
                </h1>

                {preview.meetingDescription && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {preview.meetingDescription}
                  </p>
                )}
              </div>

              {/* Minimal Metadata List */}
              <div className="space-y-2 text-xs border-t border-b border-border/80 py-3 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    <Calendar size={14} className="text-emerald-500" />
                    Scheduled At:
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDateTimeStr(preview.meetingScheduledAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    <Clock size={14} className="text-emerald-500" />
                    Duration:
                  </span>
                  <span className="font-semibold text-foreground">
                    {preview.meetingDurationMinutes} minutes
                  </span>
                </div>
              </div>

              {/* Organization Sign-In Prompt if not signed in */}
              {!isAuthenticated && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  🔒 Sign in to your organization account to join this meeting.
                </div>
              )}

              {/* Join Action Button */}
              <div className="pt-2">
                <Button
                  disabled={!canJoin}
                  onClick={handleJoin}
                  className="w-full h-11 text-sm font-semibold justify-center gap-2 rounded-md shadow-xs disabled:opacity-50"
                >
                  {isTooEarly ? (
                    <Clock size={16} />
                  ) : !isEndedOrCancelled ? (
                    <Video size={16} />
                  ) : null}
                  <span>{buttonText}</span>
                  {canJoin && <ArrowRight size={16} />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MeetingLobby;
