import React, { useState, useEffect } from "react";
import { TOTPAccount } from "../types";
import { isValidBase32, parseOtpInput } from "../utils/totp";
import { X, Plus, Sparkles, Key, AlertCircle, LayoutGrid, Cpu, Check } from "lucide-react";

interface AccountFormProps {
  initialAccount?: TOTPAccount | null;
  onSave: (accountData: Omit<TOTPAccount, "id" | "createdAt" | "isPinned">) => void;
  onCancel: () => void;
}

const PRESET_ISSUERS = [
  { name: "Google", bg: "bg-red-500/10 text-red-400 border-red-500/20" },
  { name: "GitHub", bg: "bg-slate-500/10 text-white border-slate-500/20" },
  { name: "Microsoft", bg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { name: "AWS", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { name: "Discord", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
];

const CATEGORY_TAGS = ["Personal", "Work", "Finance", "Social", "DevOps", "Other"];

export const AccountForm: React.FC<AccountFormProps> = ({ initialAccount, onSave, onCancel }) => {
  const [issuer, setIssuer] = useState("");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [algorithm, setAlgorithm] = useState<"SHA-1" | "SHA-256" | "SHA-512">("SHA-1");
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [category, setCategory] = useState("Personal");

  const [uriInput, setUriInput] = useState("");
  const [secretWarning, setSecretWarning] = useState<string | null>(null);

  // If editing, load initial parameters
  useEffect(() => {
    if (initialAccount) {
      setIssuer(initialAccount.issuer);
      setName(initialAccount.name);
      setSecret(initialAccount.secret);
      setAlgorithm(initialAccount.algorithm);
      setDigits(initialAccount.digits);
      setPeriod(initialAccount.period);
      setCategory(initialAccount.category || "Personal");
    }
  }, [initialAccount]);

  // Secret Validation Effect
  useEffect(() => {
    if (!secret) {
      setSecretWarning(null);
      return;
    }
    const sanitized = secret.replace(/\s+/g, "");
    if (!isValidBase32(sanitized)) {
      setSecretWarning("Warning: Secret contains invalid Base32 characters (only A-Z, 2-7 are allowed).");
    } else if (sanitized.length < 8) {
      setSecretWarning("Notice: Standard Base32 secrets are generally at least 8 or 16 characters.");
    } else {
      setSecretWarning(null);
    }
  }, [secret]);

  const handleUriParse = () => {
    if (!uriInput.trim()) return;
    const parsed = parseOtpInput(uriInput);
    if (parsed) {
      if (parsed.issuer) setIssuer(parsed.issuer);
      if (parsed.name) setName(parsed.name);
      if (parsed.secret) setSecret(parsed.secret);
      if (parsed.algorithm) setAlgorithm(parsed.algorithm);
      if (parsed.digits) setDigits(parsed.digits);
      if (parsed.period) setPeriod(parsed.period);
      
      setUriInput(""); // clear paste link box
    } else {
      setSecretWarning("Invalid URI or Base32 String format.");
    }
  };

  const selectIssuerPreset = (presetName: string) => {
    setIssuer(presetName);
    // Google, Discord, Microsoft, GitHub and AWS default to Standard TOTP
    setAlgorithm("SHA-1");
    setDigits(6);
    setPeriod(30);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();

    if (!cleanSecret) return;

    onSave({
      issuer: issuer.trim() || "Local",
      name: name.trim() || "Token Account",
      secret: cleanSecret,
      algorithm,
      digits,
      period,
      category,
    });
  };

  return (
    <div className="bg-slate-900/50 border-2 border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h3 className="text-lg font-sans font-bold text-white tracking-tight">
            {initialAccount ? "Modify Authenticator Token" : "Enroll New Authenticator"}
          </h3>
          <p className="text-xs text-slate-400">
            {initialAccount ? "Change properties of your secret token." : "Scan standard URIs or key secrets manually."}
          </p>
        </div>
        <button
          id="form-cancel-top-btn"
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-300 p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Close Dialog"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* QUICK IMPORT VIA LINK */}
      {!initialAccount && (
        <div className="mb-6 bg-slate-955 bg-slate-950 p-4 rounded-xl border border-slate-850">
          <div className="flex items-center gap-2 mb-2 text-sky-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Quick Import Link</span>
          </div>
          <p className="text-xs text-slate-400 mb-2 leading-relaxed">
            Paste an <code>otpauth://totp/...</code> link or raw secret key from your provider key setups:
          </p>
          <div className="flex gap-2">
            <input
              id="form-uri-input"
              type="text"
              placeholder="otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP..."
              value={uriInput}
              onChange={(e) => setUriInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-sky-500 transition-colors placeholder:text-slate-600"
            />
            <button
              id="form-import-btn"
              type="button"
              onClick={handleUriParse}
              className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-4 py-2.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Parse
            </button>
          </div>
        </div>
      )}

      {/* MANUAL CREDENTIAL FORM */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Presets Chips */}
        {!initialAccount && (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ISSUERS.map((prs) => (
                <button
                  id={`preset-chip-${prs.name}`}
                  key={prs.name}
                  type="button"
                  onClick={() => selectIssuerPreset(prs.name)}
                  className={`text-xs px-3 py-1.5 border rounded-lg font-medium transition-all duration-150 cursor-pointer ${
                    issuer.toLowerCase() === prs.name.toLowerCase()
                      ? "bg-sky-500 text-slate-950 border-sky-400"
                      : prs.bg + " hover:opacity-80"
                  }`}
                >
                  {prs.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="form-issuer">
              Service Issuer
            </label>
            <input
              id="form-issuer"
              type="text"
              placeholder="e.g. Google, AWS, GitHub"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="form-account-name">
              Account Identifier (Login Name / Email)
            </label>
            <input
              id="form-account-name"
              type="text"
              placeholder="e.g. user@domain.com"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </div>

        {/* SECRET KEY */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="form-secret-key">
            Secret Key (Base32 Encoded)
          </label>
          <div className="relative">
            <input
              id="form-secret-key"
              type="text"
              placeholder="e.g. JBSW Y3DP FQQW C33P"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              disabled={!!initialAccount}
              className="w-full bg-slate-955 bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-colors font-mono disabled:opacity-50"
            />
            <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          </div>
          {secretWarning && (
            <div className="text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-start gap-1.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{secretWarning}</span>
            </div>
          )}
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-800/60 pt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="form-algorithm">
              Hash Algorithm
            </label>
            <div className="relative">
              <select
                id="form-algorithm"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as any)}
                className="w-full bg-slate-955 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors"
              >
                <option value="SHA-1">SHA-1 (Default)</option>
                <option value="SHA-256">SHA-256 (High Security)</option>
                <option value="SHA-512">SHA-512 (Ultra Security)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="form-digits">
              Token Code Digits
            </label>
            <select
              id="form-digits"
              value={digits}
              onChange={(e) => setDigits(Number(e.target.value))}
              className="w-full bg-slate-955 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value={6}>6 Digits (Standard)</option>
              <option value={8}>8 Digits (Extended)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="form-period">
              Period (Refresh Time)
            </label>
            <select
              id="form-period"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="w-full bg-slate-955 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value={30}>30 Seconds (Default)</option>
              <option value={60}>60 Seconds (Long Interval)</option>
            </select>
          </div>
        </div>

        {/* CATEGORY SELECT */}
        <div className="space-y-1.5 border-t border-slate-800/60 pt-4">
          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
            Category Folder / Label
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TAGS.map((tag) => (
              <button
                id={`category-chip-${tag}`}
                key={tag}
                type="button"
                onClick={() => setCategory(tag)}
                className={`text-xs px-3.5 py-1.5 rounded-full border transition-all duration-150 cursor-pointer ${
                  category === tag
                    ? "bg-sky-500/20 text-sky-305 text-sky-300 border-sky-500/40 font-semibold"
                    : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                {category === tag && <Check className="w-3.5 h-3.5 inline mr-1 text-sky-400" />}
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* FORM BUTTONS */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-800/80">
          <button
            id="form-cancel-btn"
            type="button"
            onClick={onCancel}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="form-submit-btn"
            type="submit"
            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md cursor-pointer select-none"
          >
            {initialAccount ? "Apply Changes" : "Create Token"}
          </button>
        </div>
      </form>
    </div>
  );
};
