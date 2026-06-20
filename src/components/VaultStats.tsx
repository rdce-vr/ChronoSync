import React, { useRef, useState } from "react";
import { TOTPAccount, NTPConfig } from "../types";
import { Database, ShieldCheck, Download, Upload, AlertTriangle, CheckCircle, Tag } from "lucide-react";

interface VaultStatsProps {
  accounts: TOTPAccount[];
  ntpConfig: NTPConfig;
  securityMode: "encrypted" | "direct";
  onImportBackup: (importedData: string) => void;
}

export const VaultStats: React.FC<VaultStatsProps> = ({
  accounts,
  ntpConfig,
  securityMode,
  onImportBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate stats
  const totalTokens = accounts.length;
  const pinnedCount = accounts.filter((a) => a.isPinned).length;
  
  // Group categories
  const categories = accounts.reduce((acc: Record<string, number>, curr) => {
    const cat = curr.category || "Unassigned";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const handleExport = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Retrieve what is stored physically in localStorage (could be encrypted or decrypted based on securityMode)
    let rawContent = "";
    if (securityMode === "encrypted") {
      rawContent = localStorage.getItem("totp_vault_data") || "[]";
    } else {
      rawContent = JSON.stringify(accounts);
    }

    if (!rawContent || rawContent === "[]") {
      setErrorMsg("Cannot export an empty vault keychain.");
      return;
    }

    const backupObj = {
      version: "1.0.0",
      security: securityMode,
      verifier: localStorage.getItem("totp_vault_verifier") || "",
      payload: rawContent,
      timestamp: Date.now(),
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ChronosOTP_Backup_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setSuccessMsg("Vault backup exported successfully.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);

        if (!backup.payload) {
          setErrorMsg("Malformed backup structure: Missing payload segment.");
          return;
        }

        onImportBackup(text);
        setSuccessMsg("Vault synchronized with imported backup.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err) {
        setErrorMsg("Failed to parse backup. Make sure it is a valid JSON backup file.");
      }
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-6">
      {/* CARD 1: OVERVIEW METRICS */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            Keychain Audit
          </span>
          <span id="totp-count-badge" className="text-2xl font-bold font-mono text-sky-400">{totalTokens}</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Pinned Access:</span>
            <span className="text-white font-semibold font-mono">{pinnedCount} Tokens</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Categorized Folders:</span>
            <span className="text-white font-semibold font-mono">{Object.keys(categories).length} Folders</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-2.5">
            {Object.entries(categories).map(([cat, count]) => (
              <span key={cat} className="text-[9px] bg-slate-950/60 border border-slate-800 px-2 py-0.5 rounded text-slate-400 inline-flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {cat}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CARD 2: SECURITY INTEGRITY STATUS */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            Cryptography mode
          </span>
          {securityMode === "encrypted" ? (
            <span id="security-mode-badge" className="text-[10px] uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
              AES-GCM (256-bit)
            </span>
          ) : (
            <span id="security-mode-badge" className="text-[10px] uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold animate-pulse">
              Direct (Unsecured)
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {securityMode === "encrypted"
            ? "Your base authenticator credentials are PBKDF2 salt-keyed inside browser storage. Safe from local system memory leaks."
            : "Vault saving is in unencrypted plaintext mode. Set a Master Password for full hardware-level security locking."}
        </p>
      </div>

      {/* CARD 3: REFS AND DISK BACKUPS */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400">
            Backup and recovery
          </span>
        </div>

        <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
          Export full encryptions as JSON backups, or restore older secrets instantly.
        </p>

        <div className="flex gap-2">
          <button
            id="backup-export-btn"
            onClick={handleExport}
            className="flex-1 bg-slate-950 border border-slate-800 hover:border-sky-500/30 hover:bg-slate-950 text-slate-350 select-none text-slate-300 rounded-xl py-2 text-xs transition-colors flex items-center justify-center gap-1.5 font-sans font-medium cursor-pointer"
            title="Download safe encrypted keychain file"
          >
            <Download className="w-3.5 h-3.5" />
            Export Vault
          </button>

          <button
            id="backup-import-btn"
            onClick={triggerFileInput}
            className="flex-1 bg-slate-950 border border-slate-800 hover:border-sky-500/30 hover:bg-slate-950 text-slate-350 select-none text-slate-300 rounded-xl py-2 text-xs transition-colors flex items-center justify-center gap-1.5 font-sans font-medium cursor-pointer"
            title="Upload previously saved keychain"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Vault
          </button>
        </div>

        <input
          id="backup-hidden-file-picker"
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        {successMsg && (
          <div className="text-[10px] mt-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg flex items-center gap-1 font-mono">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="text-[10px] mt-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg flex items-center gap-1 font-mono">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
