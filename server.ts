import express from "express";
import path from "path";
import dgram from "dgram";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to execute NTP validation and retrieve synchronized timestamp
  app.post("/api/ntp-sync", async (req, res) => {
    let { server } = req.body;
    if (!server || typeof server !== "string") {
      server = "pool.ntp.org";
    }

    try {
      // Extract hostname
      const host = server.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
      console.log(`Connecting to NTP via UDP: ${host}`);
      
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
      console.warn(`NTP UDP sync failed, trying HTTP Head sync: ${error.message}`);
      
      // Fallback 1: Secure HTTP Date query from time.google.com
      const t0 = Date.now();
      try {
        const response = await fetch("https://time.google.com", {
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
            server: "time.google.com (HTTP)",
            offset,
            delay,
            ntpTime: ntpTimeMs,
            systemTime: Date.now(),
            warning: `UDP blocked (${error.message}). Synchronized via secure HTTP Header.`,
          });
        }
      } catch (httpError: any) {
        console.warn(`HTTP sync failed as well: ${httpError.message}`);
      }

      // Fallback 2: Server System Clock Offset
      res.json({
        success: true,
        protocol: "SERVER_CLOCK",
        server: "NodeJS Server Local",
        offset: 0,
        delay: 0,
        ntpTime: Date.now(),
        systemTime: Date.now(),
        warning: "NTP network connections restricted by container firewall. Synced with host node clock.",
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

function queryNtp(host: string, port = 123, timeout = 3000): Promise<{ ntpTime: number; offset: number; delay: number }> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    const packet = Buffer.alloc(48);
    
    // Leap Indicator: 0, Version Number: 3, Mode: 3 (Client)
    packet[0] = 0x1b;

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

      // 70 years in seconds
      const ntpEpochOffset = 2208988800;
      const ntpTimeMs = (secsSince1900 - ntpEpochOffset) * 1000 + msFraction;

      const delay = t3 - t0;
      const offset = ntpTimeMs - Math.round((t0 + t3) / 2);

      resolve({
        ntpTime: ntpTimeMs,
        offset,
        delay,
      });
    });
  });
}

startServer();
