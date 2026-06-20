import React, { useState, useEffect } from "react";
import { NTPConfig } from "../types";
import { Clock, RefreshCw, Server, ShieldCheck, AlertTriangle, Cpu, Globe, ChevronDown } from "lucide-react";

interface NtpIndicatorProps {
  config: NTPConfig;
  onSync: (server: string) => Promise<void>;
  loading: boolean;
  onCustomSecondsChange?: (seconds: number) => void;
}

const PRESET_NTP_SERVERS = [
  { name: "Default Pool (pool.ntp.org)", value: "pool.ntp.org" },
  { name: "Google Time (time.google.com)", value: "time.google.com" },
  { name: "Microsoft Time (time.windows.com)", value: "time.windows.com" },
  { name: "NIST Precise (time.nist.gov)", value: "time.nist.gov" },
  { name: "Apple Time (time.apple.com)", value: "time.apple.com" },
];

export const NtpIndicator: React.FC<NtpIndicatorProps> = ({
  config,
  onSync,
  loading,
  onCustomSecondsChange,
}) => {
  const [customServer, setCustomServer] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  
  const customMs = (config.customSecondsAdjustment || 0) * 1000;
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now() + config.offset + customMs);
  const [isExpanded, setIsExpanded] = useState(false);

  // Live clock ticks every 100ms for smooth feedback
  useEffect(() => {
    const timer = setInterval(() => {
      const currentCustomMs = (config.customSecondsAdjustment || 0) * 1000;
      setCurrentTimeMs(Date.now() + config.offset + currentCustomMs);
    }, 100);
    return () => clearInterval(timer);
  }, [config.offset, config.customSecondsAdjustment]);

  const handleSyncSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const serverToSync = isCustom ? customServer.trim() : config.selectedServer;
    if (serverToSync) {
      onSync(serverToSync);
    }
  };

  const formattedTime = new Date(currentTimeMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Visual top accent */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Clock and Synchronized Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-sky-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Synchronized Vault Time
              </span>
              {config.protocol === "NTP_UDP" && (
                <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
                  NTP Active
                </span>
              )}
              {config.protocol === "HTTP_FALLBACK" && (
                <span className="text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
                  HTTP Secure
                </span>
              )}
              {config.protocol === "SERVER_CLOCK" && (
                <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
                  Internal Cluster
                </span>
              )}
              {config.protocol === "LOCAL_CLIENT_ONLY" && (
                <span className="text-[9px] bg-slate-500/10 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full font-mono font-medium">
                  Offline
                </span>
              )}
            </div>
            <div id="synchronized-clock" className="text-xl sm:text-2xl font-mono font-bold text-white tabular-nums tracking-wide flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:gap-2 mt-0.5">
              <span>{formattedTime}</span>
              <div className="text-[10px] sm:text-xs font-mono font-normal text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span>({config.offset >= 0 ? `+${config.offset}` : config.offset}ms drift)</span>
                {!!config.customSecondsAdjustment && (
                  <span className="text-sky-400 font-semibold bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md">
                    {config.customSecondsAdjustment > 0 ? `+${config.customSecondsAdjustment}` : config.customSecondsAdjustment}s shifted
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Actions: Quick Sync & Configure button */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end sm:justify-start">
          <button
            id="ntp-quick-sync-btn"
            onClick={() => onSync(config.selectedServer)}
            disabled={loading}
            className="bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-medium shrink-0 disabled:opacity-50 select-none"
            title="Force Clock Sync with active reference server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Syncing..." : "Sync Clock"}</span>
          </button>

          <button
            id="ntp-toggle-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 select-none ${
              isExpanded
                ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            <span>Settings</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expandable Settings drawer */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-450 text-sky-400 font-semibold" />
            <span className="font-sans font-bold tracking-wide text-white uppercase text-[10px]">
              Precise Time Reference (NTP) Hostname
            </span>
          </div>

          <form onSubmit={handleSyncSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1">
                {!isCustom ? (
                  <select
                    id="ntp-dns-presets"
                    value={config.selectedServer}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setIsCustom(true);
                      } else {
                        onSync(e.target.value);
                      }
                    }}
                    disabled={loading}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    {PRESET_NTP_SERVERS.map((srv) => (
                      <option key={srv.value} value={srv.value}>
                        {srv.name}
                      </option>
                    ))}
                    <option value="custom">-- Custom NTP Hostname --</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      id="ntp-custom-dns"
                      type="text"
                      placeholder="e.g. ntp.xs4all.nl"
                      value={customServer}
                      onChange={(e) => setCustomServer(e.target.value)}
                      disabled={loading}
                      className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                    <button
                      id="ntp-preset-btn"
                      type="button"
                      onClick={() => setIsCustom(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2.5 text-xs rounded-xl transition-colors border border-slate-700 cursor-pointer"
                    >
                      Presets
                    </button>
                  </div>
                )}
              </div>

              {isCustom && (
                <button
                  id="ntp-sync-btn"
                  type="submit"
                  disabled={loading || (isCustom && !customServer)}
                  className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-505 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 select-none shadow-md"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Synchronizing..." : "Sync Clock"}
                </button>
              )}
            </div>
          </form>

          {/* Manual Time Offset Adjustment (Seconds) */}
          <div className="border-t border-slate-800/60 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-450 text-sky-400 font-semibold" />
              <span className="font-sans font-bold tracking-wide text-white uppercase text-[10px]">
                Manual Time Offset (Time Shift)
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-normal">
              Add or subtract exact seconds to shift the virtual clock. Useful to align with target servers that might be out of sync.
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[130px] max-w-[180px]">
                <input
                  id="ntp-custom-seconds"
                  type="number"
                  placeholder="0 (Seconds)"
                  value={config.customSecondsAdjustment || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onCustomSecondsChange?.(isNaN(val) ? 0 : val);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl pl-3.5 pr-14 py-2 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                />
                <span className="absolute right-3.5 top-2.5 text-[10px] font-mono text-slate-500 pointer-events-none select-none">
                  sec
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onCustomSecondsChange?.((config.customSecondsAdjustment || 0) + 112)}
                  className="bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-3 py-2 text-xs rounded-xl transition-all border border-slate-700 cursor-pointer font-mono font-medium"
                  title="Shift time forward by 112 seconds (+112s)"
                >
                  +112s
                </button>
                <button
                  type="button"
                  onClick={() => onCustomSecondsChange?.(0)}
                  disabled={!config.customSecondsAdjustment}
                  className="bg-slate-950 border border-slate-800 hover:bg-slate-900 disabled:opacity-20 disabled:cursor-not-allowed hover:text-slate-205 text-slate-400 px-3 py-2 text-xs rounded-xl transition-all cursor-pointer"
                  title="Reset custom seconds offset to zero"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Timing indicators table */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-850">
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-mono block">Sync Source</span>
              <span className="text-slate-300 text-xs font-semibold truncate block" title={config.selectedServer}>
                {config.selectedServer}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-slate-550 text-slate-500 text-[10px] uppercase font-mono block">Offset (Drift)</span>
              <span className={`text-xs font-bold font-mono block ${config.offset === 0 ? "text-slate-400" : Math.abs(config.offset) > 1000 ? "text-amber-400" : "text-sky-400"}`}>
                {config.offset > 0 ? `+${config.offset}` : config.offset} ms
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-mono block">Round-Trip Latency</span>
              <span className="text-slate-300 text-xs font-mono block text-slate-205">
                {config.delay > 0 ? `${config.delay} ms` : "0 ms (Local)"}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-slate-550 text-slate-500 text-[10px] uppercase font-mono block">Last Synchronized</span>
              <span className="text-slate-300 text-xs font-mono block">
                {config.lastSync ? new Date(config.lastSync).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Warning/Banner Notice if there were connectivity issues */}
      {config.warning && (
        <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="font-sans leading-normal">{config.warning}</span>
        </div>
      )}
    </div>
  );
};
