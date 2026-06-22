# ⏱️ Chronos OTP - Secure TOTP Generator

Chronos OTP is a highly secure, client-side encrypted TOTP (Time-Based One-Time Password) generator. It features a continuous real-time high-precision clock synchronized with custom NTP servers, fluid circular progress indicators, and robust local vault storage utilizing a master password with secure client-side cryptography.

---

## 🚀 Quick Start

Ensure you have your environment configured before starting. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

### 1. Docker Compose (Recommended)

Docker Compose is the easiest way to spin up the production container with hot reloading or persistent env variables.

```bash
# Build and start the service in background
docker compose up -d --build

# To see logs
docker compose logs -f

# To stop the service
docker compose down
```

The application will be accessible at: **`http://localhost:3000`**

---

### 2. Docker Command

Alternatively, you can build and run using standard individual Docker commands.

**Build the image:**
```bash
docker build -t chronos-otp:1.0.0 .
```

**Run the container:**
```bash
docker run -d \
  --name chronos-otp-web \
  -p 7332:7332 \
  --env-file .env \
  --restart unless-stopped \
  chronos-otp:1.0.0
```

The application will be accessible at: **`http://localhost:3000`**

---

### 3. Manual Install

To run the application directly on your local machine using Node.js.

**Prerequisites:**
- Node.js (v20 or higher recommended)
- npm (v10 or higher)

**Step 1: Install Dependencies**
```bash
npm install
```

**Step 2: Build the Application**
This runs the Vite production asset pipeline and bundles the custom Express gateway with `esbuild`.
```bash
npm run build
```

**Step 3: Run the Application**

- **For Production (Standalone Optimized CJS Server):**
  ```bash
  npm run start
  ```
- **For Development (with Instant Node Hot Reload):**
  ```bash
  npm run dev
  ```

The application will be accessible at: **`http://localhost:3000`**

---

## ⚙️ Configuration & Environment

The application reads configuration parameters from the environment. Rename `.env.example` to `.env` and adjust the variables accordingly:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Required for secure back-end server-side Gemini API calls. | `YOUR_API_KEY` |
| `APP_URL` | The current external hosting URL of the application. | `http://localhost:3000` |
| `PORT` | Local container port mapping. | `3000` |

---

## 🔒 Security Architecture
- **Master Password Encryption**: User vault records are derived and safely encrypted using local modern web cryptography before leaving the browser.
- **NTP Time Shift**: Offers drift identification and customizable micro-second time-shifting (`+112s` alignment buttons) to support accurate token alignment under custom clock deviations.
