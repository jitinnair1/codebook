# TD;DR
- Use API keys with low billing and usage limits
- For using local models, serve them over HTTPS

## API Key Security & Best Practices

* Encryption at Rest: Keys are stored locally in the browser's `localStorage` and encrypted with AES-GCM (256-bit) via the Web Crypto API.
* Content Security Policy (CSP): Strict CSP headers restrict unauthorized connections and script execution.
* Key Management Recommendations:
  * Client-side storage carries inherent browser-level risk (compromised extensions, shared machines).
  * Always use keys with **tight, low billing/usage limits**.
  * Prefer scoped or restricted API keys over master/account-wide keys.
  * Never use unrestricted production keys.

## Connecting Local Servers from Deployed Sites (e.g. GitHub Pages)

When accessing Warmup deployed over HTTPS (e.g. GitHub Pages), browsers block direct requests to `http://localhost:...` due to Mixed Content and Private Network Access restrictions.

### Option 1: Tailscale

`tailscale serve` exposes your local service over HTTPS using valid Let's Encrypt certificates.

1. **Enable HTTPS Certificates** in Tailscale Admin Console (**DNS** → **Enable HTTPS Certificates**).

2. **Start your local server with CORS enabled**:
   ```bash
   # Ollama
   OLLAMA_ORIGINS="*" ollama serve
   ```
   (some options like `llama-server` have `--cors` flag enabled by default)

3. **Expose over HTTPS**:
   ```bash
   tailscale serve --bg 11434
   ```
4. **Set Base URL** in Settings:
   ```text
   https://<node-name>.<tailnet-alias>.ts.net/v1
   ```
   *(Note: The client device must be connected to your Tailnet. To allow external devices without Tailscale, use `tailscale funnel 11434` instead).*

### Option 2: HTTPS Tunnels

Expose your local server via a tunnel (e.g., ngrok or Cloudflare Tunnels):

```bash
ngrok http 11434
```
Use the provided `https://...` URL as your Base URL in Settings.

### Option 3: Run Locally

Serve Warmup locally (`http://localhost:...`). HTTP-to-HTTP requests on localhost are not subject to mixed-content blocks.