import React, { useState, useEffect } from "react";
import { TOTPAccount } from "../types";
import { generateTOTPCode, generateOtpAuthUri } from "../utils/totp";
import { Pin, Trash2, Edit2, Copy, Check, QrCode, FileKey, Shield, AlertCircle } from "lucide-react";
import QRCode from "qrcode";

interface AccountCardProps {
  account: TOTPAccount;
  timeMs: number;
  onEdit: (account: TOTPAccount) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  masterPasswordUsed: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  timeMs,
  onEdit,
  onDelete,
  onTogglePin,
  masterPasswordUsed,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Compute standard dynamic code with synchronized drift timestamp
  const { code, secondsRemaining, fractionRemaining } = generateTOTPCode({
    secret: account.secret,
    algorithm: account.algorithm,
    digits: account.digits,
    period: account.period,
    currentTimeMs: timeMs,
  });

  // Dynamic formatting of code digits with a visually pleasing center space
  const formatCode = (rawCode: string) => {
    if (rawCode === "------") return rawCode;
    const half = Math.ceil(rawCode.length / 2);
    return `${rawCode.substring(0, half)} ${rawCode.substring(half)}`;
  };

  const handleCopy = () => {
    if (code === "------") return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  // Generate QR Code URI only when modal is requested to optimize memory
  useEffect(() => {
    if (showQrModal) {
      const uri = generateOtpAuthUri(account);
      QRCode.toDataURL(uri, { margin: 2, width: 250 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("QR Generation failed", err));
    }
  }, [showQrModal, account]);

  // Radius and math for the SVG countdown arc circle
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - fractionRemaining);

  // Dynamically color-code countdown circle to advise users on expiration
  const getProgressColor = () => {
    if (secondsRemaining <= 5) return "stroke-rose-500 text-rose-500 bg-rose-500/10";
    if (secondsRemaining <= 10) return "stroke-amber-500 text-amber-500 bg-amber-500/10";
    return "stroke-sky-450 stroke-sky-400 text-sky-400 bg-sky-400/10";
  };

  // Extract a readable first letter of the issuer for badge avatar
  const avatarChar = (account.issuer || "A").substring(0, 1).toUpperCase();

  return (
    <div className={`bg-slate-900/50 border-2 ${account.isPinned ? "border-sky-500/50 shadow-sky-950/15 bg-slate-900/80" : "border-slate-800/80"} rounded-2xl p-5 hover:border-slate-705 hover:border-slate-700/80 hover:shadow-xl transition-all duration-150 relative overflow-hidden group`}>
      {/* Decorative side accent for pinned keys */}
      {account.isPinned && (
        <div className="absolute top-0 bottom-0 left-0 w-[4px] bg-gradient-to-b from-sky-500 to-indigo-500" />
      )}

      <div className="flex justify-between items-start gap-3">
        {/* Account Info Labels */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center font-sans font-bold text-sky-400 text-lg shadow-inner">
            {avatarChar}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span id={`issuer-label-${account.id}`} className="font-sans font-semibold text-white text-sm tracking-wide truncate">
                {account.issuer}
              </span>
              <span className="text-[9px] bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono">
                {account.algorithm}
              </span>
              {account.category && (
                <span className="text-[9px] bg-sky-950/40 text-sky-400 border border-sky-900/40 px-1.5 py-0.5 rounded">
                  {account.category}
                </span>
              )}
            </div>
            <p id={`name-label-${account.id}`} className="text-slate-500 text-xs truncate max-w-[160px] sm:max-w-[200px]" title={account.name}>
              {account.name}
            </p>
          </div>
        </div>

        {/* Action controls (Pin, Edit, Delete) */}
        <div className="flex items-center gap-1">
          <button
            id={`pin-btn-${account.id}`}
            onClick={() => onTogglePin(account.id)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              account.isPinned
                ? "text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
                : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            }`}
            title={account.isPinned ? "Unpin Account" : "Pin Account"}
          >
            <Pin className="w-4 h-4" />
          </button>
          
          <button
            id={`edit-btn-${account.id}`}
            onClick={() => onEdit(account)}
            className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Edit Details"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            id={`delete-btn-${account.id}`}
            onClick={() => setDeleteConfirm(true)}
            className="p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Delete Token"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CORE PASSCODE KEY VALUES */}
      <div className="my-5 flex items-center justify-between gap-4">
        <button
          id={`copy-field-btn-${account.id}`}
          onClick={handleCopy}
          className="flex-1 text-left bg-slate-950 border border-slate-800 hover:border-sky-500/40 rounded-2xl px-4 py-3 cursor-pointer group/field hover:shadow-inner transition-all flex items-center justify-between"
          title="Click to copy passcode digits"
        >
          <div id={`otp-code-val-${account.id}`} className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-wider tabular-nums">
            {formatCode(code)}
          </div>
          <div className="text-slate-500 group-hover/field:text-slate-300 transition-colors">
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" />
                Copied!
              </span>
            ) : (
              <Copy className="w-4.5 h-4.5" />
            )}
          </div>
        </button>

        {/* Smooth Countdown Circle */}
        <div className="relative shrink-0 w-11 h-11 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background empty circle */}
            <circle
              cx="22"
              cy="22"
              r={radius}
              className="stroke-slate-800"
              strokeWidth="2.5"
              fill="transparent"
            />
            {/* Progress timing segment */}
            <circle
              cx="22"
              cy="22"
              r={radius}
              className={`transition-all duration-100 ease-linear ${getProgressColor()}`}
              strokeWidth="3"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          {/* Centered remaining seconds */}
          <span className="absolute text-[11px] font-mono font-bold text-white leading-none">
            {secondsRemaining}s
          </span>
        </div>
      </div>

      {/* Bottom status bar in card */}
      <div className="flex items-center justify-between border-t border-slate-850/80 pt-3 text-[10px] text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-slate-650" />
          <span>{account.digits} Digits / {account.period}s</span>
        </span>

        <button
          id={`qrcode-btn-${account.id}`}
          onClick={() => setShowQrModal(true)}
          className="text-slate-500 hover:text-sky-400 transition-colors inline-flex items-center gap-1 hover:underline cursor-pointer"
        >
          <QrCode className="w-3.5 h-3.5" />
          Get QR Configuration
        </button>
      </div>

      {/* SECURE DELETE CONFIRMATION BANNER */}
      {deleteConfirm && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center z-10 animate-fade-in">
          <AlertCircle className="w-6 h-6 text-rose-500 mb-1.5" />
          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Confirm Token Deletion</h4>
          <p className="text-[11px] text-slate-400 max-w-xs mt-1 leading-normal">
            Are you sure you want to delete <strong className="text-white bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">{account.issuer} ({account.name})</strong>? This raw key cannot be retrieved.
          </p>
          <div className="flex gap-2.5 mt-3.5">
            <button
              id={`delete-confirm-yes-${account.id}`}
              onClick={() => {
                onDelete(account.id);
                setDeleteConfirm(false);
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Delete Permanently
            </button>
            <button
              id={`delete-confirm-no-${account.id}`}
              onClick={() => setDeleteConfirm(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-700"
            >
              Keep Token
            </button>
          </div>
        </div>
      )}

      {/* QR CODE CONFIGURATION DIALOG MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-1">
              Add Account to Authenticator
            </h3>
            <p className="text-slate-300 text-xs font-medium mb-4 truncate text-center">
              {account.issuer}: {account.name}
            </p>

            <div className="bg-white border-2 border-slate-400 p-3 rounded-xl inline-block mb-4 shadow-lg">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt={`${account.issuer} QR Code`}
                  className="w-[180px] h-[180px]"
                />
              ) : (
                <div className="w-[180px] h-[180px] flex items-center justify-center text-slate-900 font-mono text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            <p className="text-slate-400 text-xs text-left leading-relaxed bg-slate-950 border border-slate-850 p-3.5 rounded-xl">
              Scan this QR code using Google Authenticator, Authy, Aegis, or any compatible authenticator client to clone keys securely.
            </p>

            <button
              id={`qrcode-close-btn-${account.id}`}
              onClick={() => setShowQrModal(false)}
              className="mt-5 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 font-semibold py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Close Dialog
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
