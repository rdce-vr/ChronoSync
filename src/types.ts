export interface TOTPAccount {
  id: string;
  name: string;      // e.g. transkudo19@gmail.com
  issuer: string;    // e.g. Google, GitHub
  secret: string;    // Base32 encoded key
  algorithm: "SHA-1" | "SHA-256" | "SHA-512";
  digits: number;    // Usually 6 or 8
  period: number;    // Default 30s
  isPinned: boolean;
  category?: string;  // e.g. "Work", "Personal"
  createdAt: number;
}

export interface NTPConfig {
  selectedServer: string;
  offset: number;     // in milliseconds
  protocol: "NTP_UDP" | "HTTP_FALLBACK" | "SERVER_CLOCK" | "LOCAL_CLIENT_ONLY";
  delay: number;      // round-trip in ms
  lastSync: number | null; // epoch timestamp
  warning?: string;
  customSecondsAdjustment?: number; // manual offset in seconds
}

export interface EnrolledVault {
  isLocked: boolean;
  hasMasterPassword: boolean;
  securityMode: "encrypted" | "direct";
}
