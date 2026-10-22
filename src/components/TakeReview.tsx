"use client";

import { useEffect, useRef, useState } from "react";
import type { RecordedTake } from "@/lib/audio/recorder";
import { MUSICAL_KEYS, settingsFromAnalysis, type AnalysisResult, type Energy, type TakeSettings } from "@/lib/audio/analysis";
import { analyzeTake } from "@/lib/audio/analyze-client";
import { uploadTake, type SavedTake } from "@/lib/tracks/upload-take";

const fieldClass = "mt-2 min-h-11 w-full rounded-lg border border-violet-300/25 bg-[#0e1028] px-3 py-2 text-sm text-white disabled:opacity-60";

export default function TakeReview({ take, onSaved, onSavingChange }: { take: RecordedTake; onSaved: () => void; onSavingChange: (saving: boolean) => void }) {
  const [takeId] = useState(() => crypto.randomUUID());
  const [settings, setSettings] = useState<TakeSettings>({ bpm: take.bpm, musicalKey: null, energy: "medium", sources: { bpm: take.bpm ? "metronome" : "user", key: "user", energy: "user" } });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisRun, setAnalysisRun] = useState(0);
  const [analysisBusy, setAnalysisBusy] = useState(true);
  const [analysisMessage, setAnalysisMessage] = useState("Preparing analysis…");
  const analysisAbort = useRef<AbortController | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const saveInFlight = useRef(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedTake | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    analysisAbort.current = controller;
    analyzeTake(take.audioBuffer, take.bpm, setAnalysisMessage, controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setResult(next);
      setSettings(settingsFromAnalysis(next, take.bpm));
      setAnalysisMessage("Analysis ready");
      setAnalysisBusy(false);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setAnalysisMessage("Analysis could not finish. Retry or enter your own values.");
      setAnalysisBusy(false);
    });
    return () => controller.abort();
  }, [take, analysisRun]);

  useEffect(() => () => uploadAbort.current?.abort(), []);

  const skipAnalysis = () => {
    analysisAbort.current?.abort();
    setAnalysisBusy(false);
    setAnalysisMessage("Set your values below, or leave tempo and key unknown.");
  };
  const save = async () => {
    if (saveInFlight.current || saved) return;
    saveInFlight.current = true;
    setAttemptedSave(true);
    setSaving(true);
    onSavingChange(true);
    setSaveError(null);
    const controller = new AbortController();
    uploadAbort.current = controller;
    try {
      const next = await uploadTake(take.blob, { id: takeId, size: take.blob.size, mimeType: "audio/wav", durationSec: take.durationSec, settings }, setProgress, controller.signal);
      if (controller.signal.aborted) return;
      setSaved(next);
      onSaved();
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(error instanceof Error ? error.message : "Saving failed. Keep this page open and retry.");
    } finally {
      saveInFlight.current = false;
      if (!controller.signal.aborted) { setSaving(false); onSavingChange(false); }
    }
  };
  const locked = analysisBusy || attemptedSave;
  const invalidBpm = settings.bpm !== null && (!Number.isFinite(settings.bpm) || settings.bpm < 40 || settings.bpm > 250);
  const sourceLabel = (source: string) => source === "user" ? "Set by you" : source === "metronome" ? "Known · metronome" : "Detected estimate";

  return (
    <div className="space-y-5 border-t border-violet-300/15 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">02 / Your take&apos;s musical settings</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Analysis stays on this device. Solo-vocal tempo and key are estimates—adjust anything that sounds wrong. Energy reflects recording loudness.</p>
        </div>
        {!attemptedSave ? (
          <button type="button" className="min-h-11 rounded-lg border border-violet-300/25 px-3 text-xs text-violet-200" onClick={analysisBusy ? skipAnalysis : () => { setAnalysisBusy(true); setAnalysisRun((n) => n + 1); }}>
            {analysisBusy ? "Set values manually" : "Analyze again"}
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-cyan-200">{analysisBusy ? "◌ " : ""}{analysisMessage}</p>
      {result?.warnings.map((warning) => <p key={warning} className="text-xs text-amber-200">{warning}</p>)}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm text-zinc-200">Tempo (BPM)
          <span className="mt-1 block text-xs text-violet-200">{sourceLabel(settings.sources.bpm)}</span>
          <input type="number" aria-label="Take tempo BPM" min={40} max={250} step={1} placeholder="Unknown" disabled={locked} value={settings.bpm ?? ""} className={fieldClass} onChange={(e) => setSettings({ ...settings, bpm: e.target.value === "" ? null : Number(e.target.value), sources: { ...settings.sources, bpm: "user" } })} />
          {settings.sources.bpm === "detected" && result?.bpmConfidence !== null && result?.bpmConfidence !== undefined ? <span className="mt-1 block text-xs text-zinc-400">Confidence: {result.bpmConfidence >= 3 ? "higher" : result.bpmConfidence >= 1.5 ? "medium" : "low"}</span> : null}
        </label>
        <label className="text-sm text-zinc-200">Musical key
          <span className="mt-1 block text-xs text-violet-200">{sourceLabel(settings.sources.key)}</span>
          <select aria-label="Take musical key" disabled={locked} value={settings.musicalKey ?? ""} className={fieldClass} onChange={(e) => setSettings({ ...settings, musicalKey: e.target.value || null, sources: { ...settings.sources, key: "user" } })}>
            <option value="">Unknown</option>
            {MUSICAL_KEYS.map((key) => <option key={key}>{key}</option>)}
          </select>
          {settings.sources.key === "detected" && result?.keyStrength != null ? <span className="mt-1 block text-xs text-zinc-400">Key strength: {Math.round(result.keyStrength * 100)}%</span> : null}
        </label>
        <label className="text-sm text-zinc-200">Energy
          <span className="mt-1 block text-xs text-violet-200">{sourceLabel(settings.sources.energy)}</span>
          <select aria-label="Take energy" disabled={locked} value={settings.energy} className={fieldClass} onChange={(e) => setSettings({ ...settings, energy: e.target.value as Energy, sources: { ...settings.sources, energy: "user" } })}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </label>
      </div>
      {invalidBpm ? <p role="alert" className="text-sm text-amber-200">Use a tempo from 40 to 250 BPM, or leave it unknown.</p> : null}
      {saved ? (
        <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-4">
          <p role="status" className="font-medium text-emerald-200">Take saved ✓</p>
          <p className="mt-1 text-sm text-zinc-200">{saved.title}</p>
          <p className="mt-1 text-xs text-zinc-400">Your vocal and settings are stored privately. You can leave this page.</p>
          {saved.playbackUrl ? <audio aria-label="Play saved vocal" controls preload="none" src={saved.playbackUrl} className="mt-3 w-full" /> : <p className="mt-2 text-xs text-amber-200">Saved successfully. Temporary playback is unavailable right now.</p>}
          <a href="/library" className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-emerald-300/30 px-4 text-sm text-emerald-200 hover:bg-emerald-300/10">View in Library</a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">This take is unsaved. Keep &amp; save uploads your vocal and these settings to your private storage.</p>
          <button type="button" onClick={() => void save()} disabled={analysisBusy || saving || invalidBpm} className="studio-primary min-h-11 rounded-lg px-5 py-3 text-sm font-semibold disabled:opacity-50">{saving ? "Saving take…" : saveError ? "Retry saving take" : "Keep & save take"}</button>
          {saving ? <div role="status"><progress aria-label="Vocal upload progress" max={100} value={progress} className="w-full accent-emerald-300" /><p className="mt-1 text-xs text-cyan-200">{progress < 99 ? `Uploading vocal: ${progress}%` : "Finishing track details…"}</p></div> : null}
          {saveError ? <p role="alert" className="text-sm text-amber-200">{saveError}</p> : null}
        </div>
      )}
    </div>
  );
}
