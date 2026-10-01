import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Clock,
  Layers,
  Search,
  ShieldCheck,
  Server,
  Terminal,
  User,
  Film
} from "lucide-react";
import type { SessionReplayData, ReplayStep } from "../types.js";
import { api } from "../services/api.js";

export const SessionReplay: React.FC = () => {
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("session-ecommerce-4821");
  const [sessionData, setSessionData] = useState<SessionReplayData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  useEffect(() => {
    const loadSessionIds = async () => {
      const ids = await api.getSessionIds();
      setSessionIds(ids);
    };
    loadSessionIds();
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      const data = await api.getSessionReplay(selectedSessionId);
      setSessionData(data);
      setCurrentStepIndex(0);
      setIsPlaying(false);
    };
    if (selectedSessionId) {
      loadSession();
    }
  }, [selectedSessionId]);

  // Automated playback timer
  useEffect(() => {
    if (!isPlaying || !sessionData) return;

    const delay = 1800 / playbackSpeed;
    const timer = setTimeout(() => {
      if (currentStepIndex < sessionData.steps.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, sessionData, playbackSpeed]);

  if (!sessionData) {
    return (
      <div className="p-12 text-center text-slate-500">
        Loading session replay...
      </div>
    );
  }

  const steps = sessionData.steps;
  const currentStep: ReplayStep | undefined = steps[currentStepIndex];

  const getStageIcon = (stage: ReplayStep["stage"]) => {
    switch (stage) {
      case "user_query":
        return <User className="w-4 h-4 text-cyan-400" />;
      case "semantic_routing":
        return <Search className="w-4 h-4 text-emerald-400" />;
      case "policy_check":
        return <Layers className="w-4 h-4 text-amber-400" />;
      case "security_scan":
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      case "downstream_execution":
        return <Server className="w-4 h-4 text-blue-400" />;
      case "response":
        return <Terminal className="w-4 h-4 text-indigo-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Selector & Meta Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Interactive Session Replay</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic step-by-step trace inspection of agent requests, dynamic routing, and policy checks.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs text-slate-400 whitespace-nowrap">Select Session:</label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer w-full md:w-auto"
          >
            {sessionIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Replay Controls & Timeline Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg">
        {/* Scrubber player bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentStepIndex === 0}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md shadow-cyan-600/30 transition-all"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Play Replay
                </>
              )}
            </button>

            <button
              onClick={() => setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
              disabled={currentStepIndex === steps.length - 1}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setCurrentStepIndex(0);
                setIsPlaying(false);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Reset to beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Speed:</span>
              <button
                onClick={() => setPlaybackSpeed(1)}
                className={`px-2 py-0.5 rounded ${playbackSpeed === 1 ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-400"}`}
              >
                1x
              </button>
              <button
                onClick={() => setPlaybackSpeed(2)}
                className={`px-2 py-0.5 rounded ${playbackSpeed === 2 ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-400"}`}
              >
                2x
              </button>
            </div>

            <div className="text-slate-300">
              Step <span className="font-bold text-cyan-400">{currentStepIndex + 1}</span> of {steps.length}
            </div>
          </div>
        </div>

        {/* Step progress pills */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-4">
          {steps.map((st, idx) => {
            const isSelected = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;

            return (
              <button
                key={st.stepNumber}
                onClick={() => {
                  setCurrentStepIndex(idx);
                  setIsPlaying(false);
                }}
                className={`p-2 rounded-lg text-left text-xs transition-all border ${
                  isSelected
                    ? "bg-cyan-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950"
                    : isCompleted
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span>#{st.stepNumber}</span>
                  {getStageIcon(st.stage)}
                </div>
                <div className="font-semibold truncate mt-1 text-[11px]">{st.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Deep-Dive View */}
      {currentStep && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Inspection Card */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  {getStageIcon(currentStep.stage)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">
                    Step {currentStep.stepNumber}: {currentStep.title}
                  </h3>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wide">
                    Stage: {currentStep.stage.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="text-right text-xs font-mono">
                <span className="text-slate-400">Duration: </span>
                <span className="text-cyan-400 font-bold">{currentStep.latencyMs}ms</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-mono block mb-1">Execution Walkthrough</span>
              <p className="text-sm text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                {currentStep.details}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-mono block mb-1">State & Trace Metadata Payload</span>
              <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-cyan-300 border border-slate-800/80 overflow-x-auto max-h-64">
                {JSON.stringify(currentStep.meta, null, 2)}
              </pre>
            </div>
          </div>

          {/* Context Sidebar */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white font-mono pb-2 border-b border-slate-800">
              Session Overview
            </h4>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Session ID</span>
                <span className="text-slate-300">{sessionData.sessionId}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Invoking Agent</span>
                <span className="text-cyan-400 font-semibold">{sessionData.agentName}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Initial Customer Prompt</span>
                <p className="text-slate-200 font-sans text-xs bg-slate-950 p-2.5 rounded border border-slate-800 mt-1">
                  "{sessionData.customerPrompt}"
                </p>
              </div>

              <div>
                <span className="text-slate-500 block">Final Session Status</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded font-bold uppercase mt-1 ${
                    sessionData.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : sessionData.status === "paused_for_approval"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {sessionData.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                Started at: {new Date(sessionData.startedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
