import "dotenv/config";
import express from "express";
import path from "path";
import dgram from "dgram";
import { createServer as createViteServer } from "vite";

// Allowlist of permitted NTP server hostnames/patterns.
// Blocks SSRF attempts against private/internal hosts.
const NTP_ALLOWLIST_PATTERNS: RegExp[] = [
  /^[\w.-]+\.ntp\.org$/,          // *.ntp.org pools
  /^[\w.-]+\.pool\.ntp\.org$/,    // regional pools
  /^time\d*\.(google|cloudflare|apple|windows)\.com$/,
  /^ntp\d*\.(ubuntu|debian)\.com$/,
  /^time\.nist\.gov$/,
  /^clock\.isc\.org$/,
];

function isAllowedNtpHost(host: string): boolean {
  // Block RFC-1918, loopback, and link-local addresses outright
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1|localhost)/i.test(host)) {
    return false;
  }
  return NTP_ALLOWLIST_PATTERNS.some((re) => re.test(host));
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 7332;

  app.use(express.json());

  // API to execute NTP validation and retrieve synchronized timestamp
  app.post("/api/ntp-sync", async (req, res) => {
    let { server } = req.body;

    if (!server || typeof server !== "string") {
      server = "pool.ntp.org";
    }

    // Extract hostname and validate against allowlist
    const host = server.replace(/^https?:\/\//, "").split("/")[0].split(":")[0].toLowerCase();

    if (!isAllowedNtpHost(host)) {
      return res.status(400).json({
        success: false,
        error: `NTP server '${host}' is not in the permitted allowlist.`,
      });
    }

    console.log(`Connecting to NTP via UDP: ${host}`);

    try {
      // NTP v4 UDP query
      const result = await queryNtp(host, 123, 3000);
      res.json({
        success: true,
        protocol: "NTP_UDP",
        server: host,
        offset: result.offset,
        delay: result.delay,
        ntpTime: result.ntpTime,
        systemTime: Date.now(),
      });
    } catch (error: any) {
      console.warn(`NTP UDP sync failed for ${host}, trying HTTP Head fallback: ${error.message}`);

      // Fallback 1: HTTP Date header from the same host (if it serves HTTP),
      // otherwise fall back to time.google.com as a known-good reference.
      const httpTargets = [`https://${host}`, "https://time.google.com"];
      for (const target of httpTargets) {
        const t0 = Date.now();
        try {
          const response = await fetch(target, {
            method: "HEAD",
            signal: AbortSignal.timeout(2000),
          });
          const t3 = Date.now();
          const dateHeader = response.headers.get("date");
          if (dateHeader) {
            const ntpTimeMs = new Date(dateHeader).getTime();
            const delay = t3 - t0;
            const offset = ntpTimeMs - Math.round((t0 + t3) / 2);
            return res.json({
              success: true,
              protocol: "HTTP_FALLBACK",
              server: target,
              offset,
              delay,
              ntpTime: ntpTimeMs,
              systemTime: Date.now(),
              warning: `UDP blocked (${error.message}). Synchronized via HTTP Date header from ${target}.`,
            });
          }
        } catch (httpError: any) {
          console.warn(`HTTP fallback failed for ${target}: ${httpError.message}`);
        }
      }

      // Fallback 2: Server system clock (offset is unknown)
      res.json({
        success: true,
        protocol: "SERVER_CLOCK",
        server: "NodeJS Server Local",
        offset: 0,
        delay: 0,
        ntpTime: Date.now(),
        systemTime: Date.now(),
        warning: "All NTP sync methods failed. Showing server system clock — accuracy not guaranteed.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// NTP v4 query (0x23 = LI:0, VN:4, Mode:3)
function queryNtp(host: string, port = 123, timeout = 3000): Promise<{ ntpTime: number; offset: number; delay: number }> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    const packet = Buffer.alloc(48);

    // Leap Indicator: 0, Version Number: 4, Mode: 3 (Client)
    packet[0] = 0x23;

    const t0 = Date.now();

    const timeoutId = setTimeout(() => {
      client.close();
      reject(new Error("Timeout waiting for response"));
    }, timeout);

    client.on("error", (err) => {
      clearTimeout(timeoutId);
      client.close();
      reject(err);
    });

    client.send(packet, 0, packet.length, port, host, (err) => {
      if (err) {
        clearTimeout(timeoutId);
        client.close();
        reject(err);
      }
    });

    client.on("message", (msg) => {
      clearTimeout(timeoutId);
      const t3 = Date.now();
      client.close();

      if (msg.length < 48) {
        return reject(new Error("Invalid NTP response package length"));
      }

      const secsSince1900 = msg.readUInt32BE(40);
      const fraction = msg.readUInt32BE(44);
      const msFraction = Math.round((fraction * 1000) / 0x100000000);

      // 70 years in seconds (NTP epoch offset from Unix epoch)
      const ntpEpochOffset = 2208988800;
      const ntpTimeMs = (secsSince1900 - ntpEpochOffset) * 1000 + msFraction;
      const delay = t3 - t0;
      const offset = ntpTimeMs - Math.round((t0 + t3) / 2);

      resolve({ ntpTime: ntpTimeMs, offset, delay });
    });
  });
}

startServer();
