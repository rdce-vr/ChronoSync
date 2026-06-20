import * as OTPAuth from "otpauth";

/**
 * Validates whether a secret is valid Base32.
 * Base32 alphabet: A-Z, 2-7. White spaces are ignored.
 */
export function isValidBase32(secret: string): boolean {
  const clean = secret.replace(/\s+/g, "");
  if (!clean) return false;
  const base32Regex = /^[A-Z2-7]+=*$/i;
  return base32Regex.test(clean);
}

/**
 * Generates a standard TOTP code for a secret given a precise system + drift time.
 * Returns the 6 or 8 digits code, seconds remaining, and total period.
 */
export function generateTOTPCode(params: {
  secret: string;
  algorithm: "SHA-1" | "SHA-256" | "SHA-512";
  digits: number;
  period: number;
  currentTimeMs: number;
}): { code: string; secondsRemaining: number; fractionRemaining: number } {
  try {
    const cleanSecret = params.secret.replace(/\s+/g, "").toUpperCase();
    
    // Create OTPAuth instance
    const totp = new OTPAuth.TOTP({
      algorithm: params.algorithm.replace("-", "") as any, // e.g. "SHA1"
      digits: params.digits,
      period: params.period,
      secret: OTPAuth.Secret.fromBase32(cleanSecret),
    });

    const code = totp.generate({ timestamp: params.currentTimeMs });
    
    // Calculate precise remaining time using milliseconds for high-frequency countdown updates
    const scaleFactor = params.period * 1000;
    const elapsedInPeriod = params.currentTimeMs % scaleFactor;
    const msRemaining = scaleFactor - elapsedInPeriod;

    return {
      code,
      secondsRemaining: Math.ceil(msRemaining / 1000),
      fractionRemaining: msRemaining / scaleFactor,
    };
  } catch (err) {
    console.warn("TOTP Generation Error:", err);
    return {
      code: "------",
      secondsRemaining: params.period,
      fractionRemaining: 1,
    };
  }
}

/**
 * Generates a standard otpauth:// URL for an account card.
 */
export function generateOtpAuthUri(account: {
  issuer: string;
  name: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
}): string {
  const cleanSecret = account.secret.replace(/\s+/g, "").toUpperCase();
  const issuerPart = encodeURIComponent(account.issuer || "TOTP");
  const labelPart = encodeURIComponent(account.name || "User");
  
  return `otpauth://totp/${issuerPart}:${labelPart}?secret=${cleanSecret}&issuer=${issuerPart}&algorithm=${account.algorithm.replace("-", "")}&digits=${account.digits}&period=${account.period}`;
}

/**
 * Parses a plain text string that might contain an otpauth:// URL or a raw secret.
 * Returns parsed parameters or null if invalid.
 */
export function parseOtpInput(input: string): {
  secret: string;
  issuer?: string;
  name?: string;
  algorithm?: "SHA-1" | "SHA-256" | "SHA-512";
  digits?: number;
  period?: number;
} | null {
  const trimmed = input.trim();
  
  if (trimmed.startsWith("otpauth://")) {
    try {
      const parsed = OTPAuth.URI.parse(trimmed);
      if (parsed instanceof OTPAuth.TOTP) {
        let algo: "SHA-1" | "SHA-256" | "SHA-512" = "SHA-1";
        if (parsed.algorithm === "SHA256") algo = "SHA-256";
        if (parsed.algorithm === "SHA512") algo = "SHA-512";

        return {
          secret: parsed.secret.base32,
          issuer: parsed.issuer || undefined,
          name: parsed.label || undefined,
          algorithm: algo,
          digits: parsed.digits || 6,
          period: parsed.period || 30,
        };
      }
    } catch (e) {
      console.warn("Failed to parse OTPAuth URI:", e);
    }
  }

  // Fallback: If it looks like a raw base32 secret, return it
  if (isValidBase32(trimmed)) {
    return {
      secret: trimmed,
    };
  }

  return null;
}
