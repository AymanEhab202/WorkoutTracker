import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Timer, ChevronDown, ChevronUp } from 'lucide-react';

interface RestTimerProps {
  initialSeconds?: number;
  onFinish?: () => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({ initialSeconds = 60, onFinish }) => {
  const [targetSeconds, setTargetSeconds] = useState<number>(initialSeconds);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  // Play audio chime using Web Audio API (zero external files required)
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {}
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            playChime();
            if (onFinish) onFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, onFinish]);

  const toggleRun = () => setIsRunning(!isRunning);

  const resetTimer = (secs: number = targetSeconds) => {
    setIsRunning(false);
    setTargetSeconds(secs);
    setSecondsRemaining(secs);
  };

  const addSeconds = (secs: number) => {
    setSecondsRemaining((prev) => prev + secs);
    setTargetSeconds((prev) => prev + secs);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = targetSeconds > 0 ? ((targetSeconds - secondsRemaining) / targetSeconds) * 100 : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden w-72 sm:w-80 transition-all">
        {/* Header Bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 cursor-pointer border-b border-slate-200 dark:border-slate-700"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-2">
            <Timer className={`w-4 h-4 ${isRunning ? 'text-indigo-600 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Rest Timer
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`font-mono font-bold text-sm ${isRunning ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {formatTime(secondsRemaining)}
            </span>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1">
          <div
            className="bg-indigo-600 h-1 transition-all duration-300"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>

        {!isMinimized && (
          <div className="p-4 flex flex-col gap-3">
            {/* Countdown display */}
            <div className="flex items-center justify-center">
              <span className={`font-mono text-4xl font-bold tracking-tight ${isRunning ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-100'}`}>
                {formatTime(secondsRemaining)}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={toggleRun}
                className={`p-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 transition flex-1 ${
                  isRunning
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => resetTimer(targetSeconds)}
                className="p-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => addSeconds(30)}
                className="px-2.5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-xl transition"
                title="Add 30 seconds"
              >
                +30s
              </button>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
              {[30, 60, 90, 120].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => resetTimer(s)}
                  className={`py-1 text-xs font-medium rounded-lg transition ${
                    targetSeconds === s
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
