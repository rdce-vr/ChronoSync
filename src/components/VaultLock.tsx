import React, { useState } from "react";
import { ShieldCheck, Eye, EyeOff, Lock, Unlock, Key, Trash2, ShieldAlert } from "lucide-react";
import { generatePasswordVerifier, decryptData } from "../utils/crypto";

interface VaultLockProps {
  hasMasterPassword: boolean;
  onUnlock: (password: string | null) => void;
  onRegisterMaster: (password: string) => Promise<void>;
  onResetVault: () => void;
}

export const VaultLock: React.FC<VaultLockProps> = ({
  hasMasterPassword,
  onUnlock,
  onRegisterMaster,
  onResetVault,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const verifier = localStorage.getItem("totp_vault_verifier");
    if (!verifier) {
      setError("No password verifier exists. Please reset the vault.");
      return;
    }

    try {
      // Test the password against the verification signature
      const decrypted = await decryptData(verifier, password);
      if (decrypted === "VALID_SESSION_SIGNATURE") {
        onUnlock(password);
      } else {
        setError("Invalid Master Password. Decryption failed.");
      }
    } catch (err) {
      setError("Incorrect password. Integrity check failed.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters for optimal PBKDF2 safety.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await onRegisterMaster(password);
    } catch (err: any) {
      setError("Registration error: " + err.message);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-slate-900/50 border-2 border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden my-12">
      <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600" />

      {/* Header and Logo */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center p-3 text-sky-400 mb-4 shadow-xl">
          {hasMasterPassword ? <Lock className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8 " />}
        </div>
        <h2 className="text-xl font-sans font-bold text-white tracking-tight">
          {hasMasterPassword ? "Vault Locked" : "Initialize Secure Vault"}
        </h2>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
          {hasMasterPassword
            ? "Enter your master password to decrypt standard TOTP tokens."
            : "Set a password that encrypts files completely client-side. Secrets never touch network servers unencrypted."}
        </p>
      </div>

      {hasMasterPassword ? (
        /* LOCK SCREEN (ENTER PASSWORD) */
        <form onSubmit={handleUnlockSubmit} className="space-y-4">
          <div className="space-y-1.5 selection:bg-sky-500">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="unlock-passwd">
              Master Password
            </label>
            <div className="relative">
              <input
                id="unlock-passwd"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-sky-500 transition-all font-mono"
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <button
                id="unlock-toggle-visible"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                title="Toggle Password Visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg leading-normal">{error}</div>}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              id="unlock-vault-btn"
              type="submit"
              className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-455 hover:from-sky-400 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <Unlock className="w-4 h-4" />
              Unlock Vault
            </button>

            <button
              id="unlock-use-unsecure-btn"
              type="button"
              onClick={() => onUnlock(null)}
              className="bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-705 hover:bg-slate-950 py-2.5 px-3.5 rounded-xl text-xs transition-colors"
              title="Work without credentials saving securely"
            >
              Direct Mode (Temporary)
            </button>
          </div>

          <div className="border-t border-slate-800/60 pt-4 mt-6 text-center">
            {!showResetConfirm ? (
              <button
                id="lock-want-reset-btn"
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Forgotten Master Password? Reset Vault
              </button>
            ) : (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 text-left">
                <div className="flex gap-2 items-start text-xs text-rose-400 mb-2 font-mono uppercase tracking-wide">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  Irreversible Action
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Resetting deletes all accounts stored securely inside your browser localStorage. Ensure you have backups before proceeding!
                </p>
                <div className="flex gap-2">
                  <button
                    id="lock-confirm-reset-btn"
                    type="button"
                    onClick={onResetVault}
                    className="bg-rose-500/90 hover:bg-rose-500 text-white font-medium py-1.5 px-3 rounded text-[11px] transition-colors"
                  >
                    Yes, Reset Everything
                  </button>
                  <button
                    id="lock-cancel-reset-btn"
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="text-slate-450 text-slate-400 hover:text-white px-2 py-1 text-[11px] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      ) : (
        /* REGISTRATION SCREEN (CREATE PASSWORD) */
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <p className="text-xs text-slate-400 bg-slate-950 p-3.5 rounded-xl border border-slate-850 leading-relaxed mb-4">
            Protect your sensitive secrets. Because this password generates encryption keys locally,
            {" "}
            <span className="text-sky-400 font-semibold">your password cannot be recovered</span>
            {" "} if forgotten. Write it down safe!
          </p>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="reg-passwd">
              Create Master Password
            </label>
            <div className="relative">
              <input
                id="reg-passwd"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-sky-505 focus:border-sky-500 transition-all font-mono"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block" htmlFor="reg-passwd-chk">
              Confirm Master Password
            </label>
            <div className="relative">
              <input
                id="reg-passwd-chk"
                type={showPassword ? "text" : "password"}
                placeholder="Match password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-sky-505 focus:border-sky-500 transition-all font-mono"
              />
              <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg leading-normal">{error}</div>}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              id="reg-vault-btn"
              type="submit"
              className="flex-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-md select-none cursor-pointer text-center"
            >
              Configure Master Vault
            </button>
            <button
              id="reg-skip-btn"
              type="button"
              onClick={() => onUnlock(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 px-4 rounded-xl text-xs transition-colors border border-slate-700"
            >
              Skip (Direct Mode)
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
