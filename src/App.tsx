import { useState, useEffect } from "react";
import { TOTPAccount, NTPConfig, EnrolledVault } from "./types";
import { NtpIndicator } from "./components/NtpIndicator";
import { VaultLock } from "./components/VaultLock";
import { AccountCard } from "./components/AccountCard";
import { AccountForm } from "./components/AccountForm";
import { VaultStats } from "./components/VaultStats";
import { encryptData, decryptData, generatePasswordVerifier } from "./utils/crypto";
import { ShieldCheck, Plus, Search, ServerOff, FolderOpen, LogOut, CheckCircle, Flame, ShieldAlert, Settings, X } from "lucide-react";

export default function App() {
  // Vault and Session lock controls
  const [vaultConfig, setVaultConfig] = useState<EnrolledVault>({
    isLocked: true,
    hasMasterPassword: false,
    securityMode: "encrypted",
  });
  const [masterPassword, setMasterPassword] = useState<string | null>(null);

  // Authenticator state
  const [accounts, setAccounts] = useState<TOTPAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Form toggles
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TOTPAccount | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Time Sync & Global Offset (NTP) state
  const [ntpConfig, setNtpConfig] = useState<NTPConfig>(() => {
    const saved = localStorage.getItem("totp_custom_seconds_adjustment");
    return {
      selectedServer: "pool.ntp.org",
      offset: 0,
      protocol: "LOCAL_CLIENT_ONLY",
      delay: 0,
      lastSync: null,
      customSecondsAdjustment: saved ? parseInt(saved, 10) : 0,
    };
  });
  const [syncLoading, setSyncLoading] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  // Toast / Status notification alerts
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "warn"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "warn" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Initial State Checks on Mount
  useEffect(() => {
    const verifier = localStorage.getItem("totp_vault_verifier");
    const hasMaster = !!verifier;
    
    setVaultConfig({
      isLocked: hasMaster, // If master password exists, start LOCKED.
      hasMasterPassword: hasMaster,
      securityMode: hasMaster ? "encrypted" : "direct",
    });

    // If there is NO master password, load standard direct accounts immediately
    if (!hasMaster) {
      const stored = localStorage.getItem("totp_direct_data");
      if (stored) {
        try {
          setAccounts(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parsed direct storage", e);
        }
      }
    }

    // Trigger an initial time synchronization with pool.ntp.org
    performNtpSync("pool.ntp.org", true);
  }, []);

  // 2. High-precision continuous ticking clock
  useEffect(() => {
    const ticker = setInterval(() => {
      const customMs = (ntpConfig.customSecondsAdjustment || 0) * 1000;
      setCurrentTimeMs(Date.now() + ntpConfig.offset + customMs);
    }, 80); // Quick sub-100ms ticks ensure our progress circles are ultra-fluid and never stutter
    return () => clearInterval(ticker);
  }, [ntpConfig.offset, ntpConfig.customSecondsAdjustment]);

  // 3. NTP Synchronization Trigger
  const performNtpSync = async (serverName: string, isSilent = false) => {
    setSyncLoading(true);
    setNtpConfig((prev) => ({ ...prev, selectedServer: serverName }));

    try {
      const response = await fetch("/api/ntp-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server: serverName }),
      });

      const data = await response.json();

      if (data.success) {
        setNtpConfig((prev) => ({
          selectedServer: data.server,
          offset: data.offset,
          protocol: data.protocol,
          delay: data.delay,
          lastSync: Date.now(),
          warning: data.warning,
          customSecondsAdjustment: prev.customSecondsAdjustment || 0,
        }));
        
        if (!isSilent) {
          showToast(`Synchronized with ${data.server}! Drift correction: ${data.offset} ms`);
        }
      } else {
        throw new Error("API returned failed response");
      }
    } catch (error: any) {
      console.warn("Time sync API failure, staying on local system ticker", error);
      if (!isSilent) {
        showToast("Synchronisation failed. Using default client timeline.", "warn");
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCustomSecondsChange = (seconds: number) => {
    setNtpConfig((prev) => ({
      ...prev,
      customSecondsAdjustment: seconds,
    }));
    localStorage.setItem("totp_custom_seconds_adjustment", seconds.toString());
    showToast(`Time offset offset shifted by ${seconds}s.`);
  };

  // 4. Register a Master Password
  const registerMasterPassword = async (password: string) => {
    try {
      const verifier = await generatePasswordVerifier(password);
      localStorage.setItem("totp_vault_verifier", verifier);
      
      // Migrate any existing plain direct accounts into the new encrypted block
      const currentPlain = accounts;
      const cipherText = await encryptData(JSON.stringify(currentPlain), password);
      localStorage.setItem("totp_vault_data", cipherText);

      // Clean unencrypted caches for peak security posture
      localStorage.removeItem("totp_direct_data");

      setMasterPassword(password);
      setVaultConfig({
        isLocked: false,
        hasMasterPassword: true,
        securityMode: "encrypted",
      });

      showToast("Master Password set! Vault client data has been securely encrypted with AES-256-GCM.");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to initialize cryptographic parameters.", "warn");
    }
  };

  // 5. Unlock with Password
  const unlockVault = async (password: string | null) => {
    if (password === null) {
      // Direct Evaluation Mode selected
      setMasterPassword(null);
      setVaultConfig((prev) => ({
        ...prev,
        isLocked: false,
        securityMode: "direct",
      }));
      
      const stored = localStorage.getItem("totp_direct_data");
      if (stored) {
        try {
          setAccounts(JSON.parse(stored));
        } catch (e) {
          setAccounts([]);
        }
      }
      showToast("Access unlocked in direct Mode. Credentials are set in plaintext localStorage.");
      return;
    }

    try {
      // Decode vault payload
      const encryptedDataStr = localStorage.getItem("totp_vault_data");
      let fetchedAccounts: TOTPAccount[] = [];
      
      if (encryptedDataStr) {
        const decryptedStr = await decryptData(encryptedDataStr, password);
        fetchedAccounts = JSON.parse(decryptedStr);
      }

      setAccounts(fetchedAccounts);
      setMasterPassword(password);
      setVaultConfig((prev) => ({
        ...prev,
        isLocked: false,
        securityMode: "encrypted",
      }));

      showToast("Vault decrypted and unlocked successfully.");
    } catch (err) {
      console.error(err);
      showToast("Integrity check failed. Incorrect master password.", "warn");
    }
  };

  // 6. Hard Reset Vault (Deletes all local data)
  const resetVault = () => {
    localStorage.removeItem("totp_vault_verifier");
    localStorage.removeItem("totp_vault_data");
    localStorage.removeItem("totp_direct_data");

    setAccounts([]);
    setMasterPassword(null);
    setVaultConfig({
      isLocked: false,
      hasMasterPassword: false,
      securityMode: "direct",
    });

    showToast("Local vault metadata deleted successfully.", "warn");
  };

  // 7. Lock Vault manually
  const lockVault = () => {
    setMasterPassword(null);
    setAccounts([]);
    setVaultConfig((prev) => ({
      ...prev,
      isLocked: true,
    }));
    showToast("Vault lock engaged.");
  };

  // Save changes helper (triggers encryption if mode is enabled)
  const saveAccountsList = async (updatedList: TOTPAccount[]) => {
    setAccounts(updatedList);

    if (vaultConfig.securityMode === "encrypted" && masterPassword) {
      try {
        const cipher = await encryptData(JSON.stringify(updatedList), masterPassword);
        localStorage.setItem("totp_vault_data", cipher);
      } catch (err) {
        showToast("Error securing local vault changes.", "warn");
      }
    } else {
      localStorage.setItem("totp_direct_data", JSON.stringify(updatedList));
    }
  };

  // 8. Add or Update Account
  const handleSaveAccount = async (formData: Omit<TOTPAccount, "id" | "createdAt" | "isPinned">) => {
    let updated: TOTPAccount[];

    if (editingAccount) {
      // Update
      updated = accounts.map((acc) =>
        acc.id === editingAccount.id
          ? {
              ...acc,
              ...formData,
            }
          : acc
      );
      showToast(`Updated credentials for: ${formData.issuer}`);
    } else {
      // Create
      const newAccount: TOTPAccount = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        createdAt: Date.now(),
        isPinned: false,
        ...formData,
      };
      updated = [newAccount, ...accounts];
      showToast(`Enrolled new token for: ${formData.issuer}`);
    }

    await saveAccountsList(updated);
    setEditingAccount(null);
    setShowForm(false);
  };

  // 9. Delete Account
  const handleDeleteAccount = async (id: string) => {
    const filt = accounts.filter((acc) => acc.id !== id);
    await saveAccountsList(filt);
    showToast("Token deleted from secure files.");
  };

  // 10. Toggle Pin
  const handleTogglePin = async (id: string) => {
    const updated = accounts.map((acc) =>
      acc.id === id ? { ...acc, isPinned: !acc.isPinned } : acc
    );
    await saveAccountsList(updated);
  };

  // 11. Process Encrypted JSON Backup Import
  const handleImportBackup = async (backupJsonText: string) => {
    try {
      const backup = JSON.parse(backupJsonText);
      
      if (backup.security === "encrypted") {
        if (!vaultConfig.hasMasterPassword) {
          // Store directly and require them to lock/unlock to align with the imported master password
          localStorage.setItem("totp_vault_verifier", backup.verifier);
          localStorage.setItem("totp_vault_data", backup.payload);
          
          setVaultConfig({
            hasMasterPassword: true,
            isLocked: true,
            securityMode: "encrypted",
          });
          setAccounts([]);
          setMasterPassword(null);
          showToast("Sync success. Vault locked. Enter the imported master password to inspect keys.");
        } else {
          // If we already have a key, we attempt to decrypted the imported payload with CURRENT password
          // If it fails, we replace local storages directly but log out to enforce security checks
          try {
            if (masterPassword) {
              const decrypted = await decryptData(backup.payload, masterPassword);
              const importedAccountsList = JSON.parse(decrypted);
              await saveAccountsList(importedAccountsList);
              showToast("Vault imported and decrypted successfully!");
            } else {
              throw new Error("No password in memory");
            }
          } catch {
            // Decryption failed with current password! We will replace storage entirely and force locker login.
            localStorage.setItem("totp_vault_verifier", backup.verifier);
            localStorage.setItem("totp_vault_data", backup.payload);
            setMasterPassword(null);
            setAccounts([]);
            setVaultConfig({
              hasMasterPassword: true,
              isLocked: true,
              securityMode: "encrypted",
            });
            showToast("Imported vault uses a different password. Please enter the backup's password.", "warn");
          }
        }
      } else {
        // Direct backup
        const parsedAccounts = JSON.parse(backup.payload);
        await saveAccountsList(parsedAccounts);
        showToast("Direct plain backup imported successfully.");
      }
    } catch {
      showToast("Failed to process backup file structure.", "warn");
    }
  };

  // Filtering Logic
  const filteredAccounts = accounts
    .filter((acc) => {
      const matchesSearch =
        acc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory =
        activeCategory === "All" || acc.category === activeCategory;

      return matchesSearch && matchesCategory;
    })
    // Sort: pinned elements on top, then newest created elements
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 selection:bg-sky-500 selection:text-slate-900 pb-20">
      {/* GLOBAL HEADER BAR */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 transition-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-950/20">
              <ShieldCheck className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 id="app-title" className="text-xl font-sans font-bold tracking-tight text-white leading-none">
                Chronos<span className="text-sky-400">Sync</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-1">
                NTP-Synchronized TOTP Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!vaultConfig.isLocked && (
              <button
                id="header-vault-menu-btn"
                onClick={() => setShowStatsModal(true)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl px-3 sm:px-4 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98] select-none"
                title="Vault diagnostics and backups menu"
              >
                <Settings className="w-3.5 h-3.5 text-sky-400" />
                <span>Vault Menu</span>
              </button>
            )}

            {!vaultConfig.isLocked && vaultConfig.hasMasterPassword && (
              <button
                id="header-logout-btn"
                onClick={lockVault}
                className="bg-slate-900 hover:bg-slate-800 text-slate-350 hover:text-white border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98] select-none"
                title="Lock Vault session"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Lock Vault</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* GLOBAL ALERTS TOAST */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`p-4 rounded-xl shadow-2xl flex items-center gap-2.5 border text-xs max-w-sm ${
            toastMessage.type === "warn"
              ? "bg-rose-950/90 text-rose-300 border-rose-800"
              : "bg-sky-950/90 text-sky-300 border-sky-850"
          }`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="font-sans leading-normal">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* CORE GRID LAYOUT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {vaultConfig.isLocked ? (
          /* LOCKED VAULT FORM CHASSIS */
          <VaultLock
            hasMasterPassword={vaultConfig.hasMasterPassword}
            onUnlock={unlockVault}
            onRegisterMaster={registerMasterPassword}
            onResetVault={resetVault}
          />
        ) : (
          /* UNLOCKED SYSTEM ACTIONS */
          <div className="space-y-6">
            
            {/* NTP Precision reference banner */}
            <NtpIndicator
              config={ntpConfig}
              onSync={(s) => performNtpSync(s)}
              loading={syncLoading}
              onCustomSecondsChange={handleCustomSecondsChange}
            />

            {/* MODAL: Vault stats diagnostics & backup recovery details */}
            {showStatsModal && (
              <div id="vault-settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                {/* Backdrop Blur */}
                <div 
                  className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm transition-opacity" 
                  onClick={() => setShowStatsModal(false)}
                />
                
                {/* Modal Container */}
                <div className="relative transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 text-left shadow-2xl transition-all w-full max-w-4xl z-50 animate-fade-in">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-sans font-bold text-white leading-none">
                          Vault Diagnostics & Backup
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-1">
                          Operational audit controls and cryptographic integrity
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setShowStatsModal(false)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                      title="Dismiss Menu"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Content: Render VaultStats inside */}
                  <div className="my-2 max-h-[70vh] overflow-y-auto pr-1">
                    <VaultStats
                      accounts={accounts}
                      securityMode={vaultConfig.securityMode}
                      onImportBackup={(importedText) => {
                        handleImportBackup(importedText);
                        // Optional: Keep modal open so they can see completion toast/success inside VaultStats
                      }}
                      ntpConfig={ntpConfig}
                    />
                  </div>
                  
                  {/* Modal Footer */}
                  <div className="mt-5 pt-3 border-t border-slate-805 border-slate-800/60 flex justify-end">
                    <button
                      onClick={() => setShowStatsModal(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold px-4.5 py-2 rounded-xl text-xs transition-all cursor-pointer select-none active:scale-95"
                    >
                      Close Menu
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT MANAGEMENT DASHBOARD LAYOUT */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 shadow-md space-y-6">
              
              {/* Dashboard Controls: Search, Select Filter, Add Token */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <input
                    id="search-tokens-input"
                    type="text"
                    placeholder="Search accounts, labels, or issuers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-colors placeholder:text-slate-600"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                </div>

                {/* Form Opener */}
                {!showForm && (
                  <button
                    id="trigger-add-token-btn"
                    onClick={() => {
                      setEditingAccount(null);
                      setShowForm(true);
                    }}
                    className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-950/20 select-none"
                  >
                    <Plus className="w-4.5 h-4.5 text-white" />
                    New Authenticator
                  </button>
                )}
              </div>

              {/* Categorization tabs bar */}
              <div className="flex border-b border-slate-800/80 pb-3 overflow-x-auto gap-2.5 scrollbar-thin">
                {["All", "Personal", "Work", "Finance", "Social", "DevOps", "Other"].map((cat) => (
                  <button
                    id={`filter-tab-${cat}`}
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-3.5 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                      activeCategory === cat
                        ? "bg-slate-950 text-sky-400 border-sky-500/20 font-semibold"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* ACTIVE CREDENTIAL ADD/EDIT CONDITIONAL DIALOG */}
              {showForm && (
                <div className="my-5 animate-fade-in border border-sky-500/2 transition-all rounded-2xl bg-slate-900/40 p-[1px]">
                  <AccountForm
                    initialAccount={editingAccount}
                    onSave={handleSaveAccount}
                    onCancel={() => {
                      setShowForm(false);
                      setEditingAccount(null);
                    }}
                  />
                </div>
              )}

              {/* DYNAMIC TOKEN GRID */}
              {filteredAccounts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      timeMs={currentTimeMs}
                      onEdit={(acc) => {
                        setEditingAccount(acc);
                        setShowForm(true);
                        // Scroll to top of section for visibility
                        window.scrollTo({ top: 380, behavior: "smooth" });
                      }}
                      onDelete={handleDeleteAccount}
                      onTogglePin={handleTogglePin}
                      masterPasswordUsed={!!masterPassword}
                    />
                  ))}
                </div>
              ) : (
                /* EMPTY VAULT CHASSIS */
                <div className="text-center py-16 bg-slate-950/30 border border-slate-850 rounded-xl">
                  <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center mx-auto text-slate-600 mb-4 ">
                    {searchQuery ? <ServerOff className="w-5.5 h-5.5" /> : <FolderOpen className="w-5.5 h-5.5 animate-pulse" />}
                  </div>
                  <h3 className="text-sm font-sans font-medium text-slate-300">
                    {searchQuery ? "No matching accounts found" : "Your authenticators vault is empty"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-normal">
                    {searchQuery
                      ? "Double-check character spellings or query tags."
                      : 'Enroll your first authenticator account (like Google, Slack, AWS, or Discord) by clicking "New Authenticator" above!'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
