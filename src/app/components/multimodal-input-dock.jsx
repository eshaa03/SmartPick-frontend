import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Camera, Image, Send, X } from 'lucide-react';
import {
  readPreferences,
  subscribePreferences,
} from '../lib/user-preferences';

const BAR_COUNT = 20;

export function MultiModalInputDock({ onSubmit, isSubmitting = false, desktopAnchorPx = null }) {
  const [query, setQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [audioError, setAudioError] = useState('');
  const [preferences, setPreferences] = useState(() => readPreferences());
  const [waveformBars, setWaveformBars] = useState(Array(BAR_COUNT).fill(8));
  const [liveTranscript, setLiveTranscript] = useState('');

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const analyserSourceRef = useRef(null);
  const waveformFrameRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechFinalTranscriptRef = useRef('');
  const liveTranscriptRef = useRef('');
  const speechStopTimerRef = useRef(null);
  const fallbackWaveTimerRef = useRef(null);

  useEffect(() => subscribePreferences(setPreferences), []);

  useEffect(() => {
    if (!preferences.textInput) {
      setQuery('');
    }
    if (!preferences.imageInput) {
      setUploadedImage(null);
      setUploadedImageName('');
      stopCamera();
      setShowCamera(false);
    }
    if (!preferences.voiceInput && isRecording) {
      stopRecording();
    }
  }, [preferences, isRecording]);

  useEffect(() => {
    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [showCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopRecording();
      stopAudioVisualizer();
      stopFallbackWaveform();
      stopSpeechRecognition();
    };
  }, []);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setCameraError('Could not access camera.');
      setShowCamera(false);
      console.error('Camera error', err);
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setUploadedImage(imageDataUrl);
    setUploadedImageName(`camera-capture-${Date.now()}.jpg`);
    setShowCamera(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(typeof reader.result === 'string' ? reader.result : null);
      setUploadedImageName(file.name || `uploaded-image-${Date.now()}.jpg`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const stopAudioVisualizer = () => {
    if (waveformFrameRef.current) {
      cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }
    if (analyserSourceRef.current) {
      try {
        analyserSourceRef.current.disconnect();
      } catch {
        // ignore disconnect errors
      }
      analyserSourceRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setWaveformBars(Array(BAR_COUNT).fill(8));
  };

  const startFallbackWaveform = () => {
    if (fallbackWaveTimerRef.current) clearInterval(fallbackWaveTimerRef.current);
    fallbackWaveTimerRef.current = setInterval(() => {
      setWaveformBars((prev) =>
        prev.map(() => Math.max(6, Math.min(24, 8 + Math.round(Math.random() * 16))))
      );
    }, 90);
  };

  const stopFallbackWaveform = () => {
    if (fallbackWaveTimerRef.current) {
      clearInterval(fallbackWaveTimerRef.current);
      fallbackWaveTimerRef.current = null;
    }
    setWaveformBars(Array(BAR_COUNT).fill(8));
  };

  const startAudioVisualizer = (stream) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.85;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      analyserSourceRef.current = source;

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(data);
        const chunkSize = Math.max(1, Math.floor(data.length / BAR_COUNT));
        const nextBars = Array.from({ length: BAR_COUNT }, (_, index) => {
          const start = index * chunkSize;
          const end = Math.min(data.length, start + chunkSize);
          let total = 0;
          for (let i = start; i < end; i += 1) total += data[i];
          const avg = end > start ? total / (end - start) : 0;
          return Math.max(6, Math.min(28, Math.round((avg / 255) * 28)));
        });

        setWaveformBars(nextBars);
        waveformFrameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (err) {
      console.error('Audio visualizer failed:', err);
    }
  };

  const stopSpeechRecognition = () => {
    if (speechStopTimerRef.current) {
      clearTimeout(speechStopTimerRef.current);
      speechStopTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      } catch {
        // ignore speech stop issues
      }
      speechRecognitionRef.current = null;
    }
  };

  const requestSpeechRecognitionStop = () => {
    if (!speechRecognitionRef.current) return;
    try {
      speechRecognitionRef.current.stop();
    } catch {
      // ignore speech stop issues
    }
  };

  const startSpeechRecognition = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return false;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onresult = (event) => {
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = (event.results[i][0]?.transcript || '').trim();
          if (!text) continue;
          if (event.results[i].isFinal) {
            speechFinalTranscriptRef.current = [
              speechFinalTranscriptRef.current,
              text,
            ].filter(Boolean).join(' ').trim();
          } else {
            interimText = [interimText, text].filter(Boolean).join(' ').trim();
          }
        }

        const merged = [speechFinalTranscriptRef.current, interimText].filter(Boolean).join(' ').trim();
        liveTranscriptRef.current = merged;
        setLiveTranscript(merged);
      };

      recognition.onerror = (event) => {
        if (event?.error === 'not-allowed') {
          setAudioError('Microphone permission denied for speech recognition.');
        } else if (event?.error === 'no-speech') {
          // keep listening until user taps stop
          return;
        }
      };
      recognition.onend = () => {
        speechRecognitionRef.current = null;
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
      return true;
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      return false;
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      requestSpeechRecognitionStop();
      if (speechStopTimerRef.current) clearTimeout(speechStopTimerRef.current);
      speechStopTimerRef.current = setTimeout(() => {
        const transcriptText = (
          speechFinalTranscriptRef.current ||
          liveTranscriptRef.current
        ).trim();
        if (!transcriptText) {
          setAudioError('Could not capture clear speech. Please try again.');
        } else {
          setAudioError('');
          setQuery((prev) =>
            [prev.trim(), transcriptText].filter(Boolean).join(' ').trim()
          );
        }
        stopSpeechRecognition();
        stopAudioVisualizer();
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track) => track.stop());
          recordingStreamRef.current = null;
        }
        setLiveTranscript('');
        speechFinalTranscriptRef.current = '';
        liveTranscriptRef.current = '';
        setIsRecording(false);
      }, 700);
      return;
    }

    stopAudioVisualizer();
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  const startRecording = async () => {
    try {
      setAudioError('');
      setLiveTranscript('');
      speechFinalTranscriptRef.current = '';
      liveTranscriptRef.current = '';

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      recordingStreamRef.current = stream;
      startAudioVisualizer(stream);

      const speechStarted = startSpeechRecognition();
      if (speechStarted) {
        setIsRecording(true);
        return;
      }

      // Keep audio waveform active even when speech-to-text is unavailable.
      setAudioError('Voice typing is not supported in this browser. Please use Chrome or Edge.');
      setIsRecording(false);
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }
      stopAudioVisualizer();
      return;
    } catch (err) {
      setAudioError('Could not start voice capture. Please check microphone permission.');
      setIsRecording(false);
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }
      stopAudioVisualizer();
      console.error('Microphone error', err);
    }
  };

  const handleVoiceToggle = () => {
    if (!preferences.voiceInput || isSubmitting) return;
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedQuery = preferences.textInput ? query.trim() : '';
    const hasImage = preferences.imageInput && uploadedImage;
    if (!trimmedQuery && !hasImage) return;

    const payload = {
      source: hasImage ? 'image' : 'text',
      query: trimmedQuery,
      imageDataUrl: hasImage ? uploadedImage : null,
      imageName: hasImage ? uploadedImageName : '',
    };

    setQuery('');
    setUploadedImage(null);
    setUploadedImageName('');

    await onSubmit(payload);
  };

  return (
    <motion.div
      className="fixed bottom-[6.1rem] sm:bottom-[5.35rem] md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[min(100vw-1rem,56rem)] sm:w-[min(100vw-2rem,56rem)] px-1 sm:px-0 will-change-[left]"
      style={desktopAnchorPx ? { left: `${desktopAnchorPx}px` } : undefined}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.19, 1.0, 0.22, 1.0] }}
    >
      <div
        className={`search-dock rounded-[28px] p-2 transition-all duration-300 ${
          query || uploadedImage ? 'glow-blue-subtle' : ''
        }`}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-1 sm:gap-2">
          <AnimatePresence>
            {uploadedImage && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative"
              >
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUploadedImage(null);
                    setUploadedImageName('');
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {preferences.textInput ? (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you're looking for..."
              className="flex-1 min-w-0 bg-transparent px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-slate-100 placeholder-slate-500 outline-none search-input"
              disabled={isSubmitting}
            />
          ) : (
            <div className="flex-1 min-w-0 px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-slate-500 search-input-disabled">
              Text input disabled in Preferences
            </div>
          )}

          {preferences.voiceInput && (
            <motion.button
              type="button"
              onClick={handleVoiceToggle}
              className={`p-2 sm:p-3 rounded-full transition-all duration-300 search-action ${
                isRecording ? 'bg-red-500/80 text-white' : ''
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isSubmitting}
            >
              <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isRecording ? 'animate-pulse' : ''}`} />
            </motion.button>
          )}

          {preferences.imageInput && (
            <motion.button
              type="button"
              onClick={() => setShowCamera(!showCamera)}
              className="p-2 sm:p-3 rounded-full transition-all duration-300 search-action"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isSubmitting}
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          )}

          {preferences.imageInput && (
            <>
              <motion.button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="p-2 sm:p-3 rounded-full transition-all duration-300 search-action"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isSubmitting}
              >
                <Image className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </>
          )}

          <motion.button
            type="submit"
            disabled={
              isSubmitting ||
              ((!preferences.textInput || !query.trim()) &&
                (!preferences.imageInput || !uploadedImage))
            }
            className="p-2 sm:p-3 rounded-full search-send disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{
              scale:
                !isSubmitting &&
                ((preferences.textInput && query.trim()) ||
                  (preferences.imageInput && uploadedImage))
                  ? 1.05
                  : 1,
            }}
            whileTap={{
              scale:
                !isSubmitting &&
                ((preferences.textInput && query.trim()) ||
                  (preferences.imageInput && uploadedImage))
                  ? 0.95
                  : 1,
            }}
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        </form>

        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 pb-2 px-4 space-y-2">
                <div className="flex items-end gap-1 h-8">
                  {waveformBars.map((height, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-amber-300/95"
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </div>
                <span className="text-sm text-slate-400 block">
                  {liveTranscript || 'Listening... tap mic again to send'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(audioError || cameraError) && (
          <div className="px-4 pb-2 text-xs text-red-400">
            {audioError || cameraError}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCamera && preferences.imageInput && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="mt-3 glass-strong rounded-2xl p-3"
          >
            <div className="relative overflow-hidden rounded-xl border border-slate-700/70">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-72 object-cover bg-slate-900"
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(false)}
                className="px-3 py-2 text-xs rounded-lg bg-slate-800 text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white"
              >
                Capture
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
