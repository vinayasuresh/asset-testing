import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { storage } from "../storage";

const router = Router();

/**
 * @swagger
 * /enroll:
 *   get:
 *     summary: Device enrollment page with platform detection
 *     tags: [Enrollment]
 *     parameters:
 *       - in: query
 *         name: os
 *         schema:
 *           type: string
 *           enum: [mac, win, linux]
 *         description: Override platform detection
 *     responses:
 *       200:
 *         description: Enrollment page HTML
 */
router.get("/", (req: Request, res: Response) => {
  // Allow manual override: /enroll?os=mac or /enroll?os=win or /enroll?os=linux
  const osOverride = String(req.query.os ?? "").toLowerCase();

  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  const isMacUA = ua.includes("mac os x") || ua.includes("macintosh");
  const isWinUA = ua.includes("windows");
  const isLinuxUA = ua.includes("linux") && !ua.includes("android");

  const isMac = osOverride === "mac" ? true : osOverride === "win" || osOverride === "linux" ? false : isMacUA;
  const isWin = osOverride === "win" ? true : osOverride === "mac" || osOverride === "linux" ? false : isWinUA;
  const isLinux = osOverride === "linux" ? true : osOverride === "mac" || osOverride === "win" ? false : isLinuxUA;

  // Files placed under /static/installers/
  const macUrl = "/static/installers/itam-agent-mac-dev.pkg";
  const winUrl = "/static/installers/itam-agent-win.exe";
  const linuxUrl = "/enroll/linux-installer"; // Auto-terminal installer
  const linuxScriptUrl = "/static/installers/itam-agent-linux-gui.sh"; // Direct script download
  const linuxCliUrl = "/static/installers/itam-agent-linux.sh";

  const primaryUrl = isMac ? macUrl : isLinux ? linuxUrl : winUrl;
  const primaryLabel = isMac
    ? "Download for macOS (.pkg)"
    : isLinux
    ? "Download Auto-Installer (.sh)"
    : "Download for Windows (.exe)";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ITAM Agent Enrollment</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root{color-scheme:dark}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:2rem;background:#0b1220;color:#e6edf3}
    .card{max-width:720px;margin:0 auto;background:#111827;border:1px solid #263043;border-radius:16px;padding:1.5rem;box-shadow:0 10px 30px rgba(0,0,0,0.25)}
    h1{font-size:1.4rem;margin:0 0 .5rem}
    p{opacity:.9;line-height:1.6}
    .actions{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem}
    a.btn{display:inline-block;padding:.75rem 1rem;border-radius:10px;border:1px solid #304156;text-decoration:none;color:#e6edf3}
    a.btn.primary{background:#1f6feb;border-color:#1f6feb}
    small{opacity:.75}
    code{background:#0d1626;padding:.2rem .35rem;border-radius:6px}
    .hint{margin-top:.75rem;color:#9fb3c8}
    .install-note{margin-top:1rem;padding:1rem;background:#0d1626;border-radius:8px;border-left:3px solid #1f6feb}
    .install-note code{background:#111827}
  </style>
</head>
<body>
  <div class="card">
    <h1>Install ITAM Agent</h1>
    <p>This will install the agent and register your device with the IT Asset Management system.</p>

    <div class="actions">
      <a class="btn primary" id="primary" href="${primaryUrl}">${primaryLabel}</a>
      <a class="btn" href="${winUrl}">Windows (.exe)</a>
      <a class="btn" href="${macUrl}">macOS (.pkg)</a>
      <a class="btn" href="${linuxUrl}">Linux (GUI)</a>
      <a class="btn" href="${linuxCliUrl}">Linux (CLI)</a>
    </div>

    <p class="hint"><small>The download should start automatically. If not, click the button above.</small></p>
    ${isLinux ? `
    <div class="install-note" style="background:#0d1929;border-left:3px solid #2ea043;padding:1.5rem;">
      <h3 style="margin-top:0;color:#58a6ff;font-size:1.2rem;">📋 Register Your Linux Device</h3>
      <p style="margin:0.75rem 0;line-height:1.6;">The audit script has been downloaded. Run this command in your terminal to register your device:</p>

      <div style="margin:1rem 0;padding:1rem;background:#0b1220;border-radius:8px;border:2px solid #1f6feb;">
        <code id="installCmd" style="display:block;color:#7ee787;font-size:15px;font-family:'Courier New',monospace;user-select:all;font-weight:500;">cd ~/Downloads && sudo bash audit_linux.sh</code>
      </div>

      <button onclick="copyInstallCmd()" style="padding:0.75rem 1.5rem;background:#2ea043;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;box-shadow:0 4px 6px rgba(0,0,0,0.2);">
        📋 Copy Command
      </button>

      <div style="margin-top:1.5rem;padding:1rem;background:#0b1220;border-radius:6px;border:1px solid #21262d;">
        <p style="margin:0 0 0.5rem;font-weight:600;color:#e6edf3;">ℹ️ What happens:</p>
        <ol style="margin:0.5rem 0 0 1.25rem;padding:0;line-height:1.8;opacity:0.9;">
          <li>Script collects device hardware and software information</li>
          <li>Device is automatically registered in the ITAM system</li>
          <li>View and manage your device in the Assets dashboard</li>
          <li>Asset information updates automatically</li>
        </ol>
      </div>
    </div>
    <script>
      function copyInstallCmd() {
        const cmd = document.getElementById('installCmd').textContent;
        navigator.clipboard.writeText(cmd).then(() => {
          event.target.textContent = '✅ Copied! Paste in your terminal';
          setTimeout(() => { event.target.textContent = '📋 Copy Command'; }, 3000);
        });
      }
    </script>
    ` : '<p class="hint"><small>No terminal or VPN required.</small></p>'}
    <p class="hint"><small>Tip: append <code>?os=mac</code>, <code>?os=win</code>, or <code>?os=linux</code> to test platform detection.</small></p>
  </div>

  <script>
    // Auto-trigger the primary download after a short delay
    setTimeout(function(){
      var a = document.getElementById('primary');
      if (a && a.href) window.location.href = a.href;
    }, 1000);
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});

/**
 * @swagger
 * /enroll/linux-installer:
 *   get:
 *     summary: Download Linux audit script with embedded enrollment token
 *     tags: [Enrollment]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Enrollment token to embed in the script
 *     responses:
 *       200:
 *         description: Linux audit script
 *         content:
 *           application/x-shellscript:
 *             schema:
 *               type: string
 *       404:
 *         description: Script not found
 */
router.get("/linux-installer", async (req: Request, res: Response) => {
  try {
    const scriptPath = path.join(process.cwd(), "build/linux/agent/audit_linux.sh");

    // Check if file exists
    if (!fs.existsSync(scriptPath)) {
      res.status(404).send("Linux audit script not found");
      return;
    }

    // Read the audit script
    let auditScript = fs.readFileSync(scriptPath, "utf-8");

    // Get enrollment token from query parameter
    const token = String(req.query.token ?? "").trim();

    // If token is provided, validate it and embed configuration into the script
    if (token) {
      const enrollmentToken = await storage.validateEnrollmentToken(token);

      if (enrollmentToken) {
        // Determine the server URL from request or environment
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host || req.hostname;
        const serverUrl = process.env.PUBLIC_URL || `${protocol}://${host}`;

        // Inject enrollment configuration at the beginning of the script (after the shebang)
        const configBlock = `
# ============================================
# ITAM ENROLLMENT CONFIGURATION (Auto-injected)
# Token: ${enrollmentToken.name || 'Device Enrollment'}
# ============================================
ENROLLMENT_TOKEN="${token}"
ITAM_SERVER_URL="${serverUrl}"
TENANT_NAME="${enrollmentToken.name || ''}"
# ============================================

`;
        // Insert after the shebang line
        const shebangEnd = auditScript.indexOf('\n');
        if (shebangEnd > 0) {
          auditScript = auditScript.slice(0, shebangEnd + 1) + configBlock + auditScript.slice(shebangEnd + 1);
        } else {
          auditScript = configBlock + auditScript;
        }

        console.log(`[Linux Installer] Embedded enrollment token for tenant: ${enrollmentToken.tenantId}`);
      } else {
        console.warn(`[Linux Installer] Invalid or expired token provided: ${token.slice(0, 8)}...`);
      }
    }

    res.setHeader("Content-Type", "application/x-shellscript");
    res.setHeader("Content-Disposition", 'attachment; filename="audit_linux.sh"');
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(auditScript);
  } catch (error) {
    console.error("Error serving Linux installer:", error);
    res.status(500).send("Error generating installer");
  }
});

/**
 * @swagger
 * /enroll/{token}:
 *   get:
 *     summary: Device enrollment page with specific enrollment token
 *     tags: [Enrollment]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Enrollment token UUID
 *       - in: query
 *         name: os
 *         schema:
 *           type: string
 *           enum: [mac, win, linux]
 *         description: Override platform detection
 *     responses:
 *       200:
 *         description: Enrollment page HTML
 *       404:
 *         description: Invalid or expired enrollment token
 */
router.get("/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  // Validate the enrollment token
  const enrollmentToken = await storage.validateEnrollmentToken(token);

  if (!enrollmentToken) {
    // Return a styled 404 page for invalid/expired tokens
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invalid Enrollment Link</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root{color-scheme:dark}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:2rem;background:#0b1220;color:#e6edf3;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{max-width:500px;background:#111827;border:1px solid #263043;border-radius:16px;padding:2rem;box-shadow:0 10px 30px rgba(0,0,0,0.25);text-align:center}
    h1{font-size:1.5rem;margin:0 0 1rem;color:#f87171}
    p{opacity:.9;line-height:1.6;margin:0 0 1rem}
    .icon{font-size:3rem;margin-bottom:1rem}
    a{color:#60a5fa;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Invalid or Expired Enrollment Link</h1>
    <p>This enrollment link is no longer valid. It may have expired or already been used.</p>
    <p>Please contact your IT administrator for a new enrollment link.</p>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(404).send(html);
    return;
  }

  // Valid token - serve the enrollment page with token context
  // Allow manual override: /enroll/{token}?os=mac or /enroll/{token}?os=win or /enroll/{token}?os=linux
  const osOverride = String(req.query.os ?? "").toLowerCase();

  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  const isMacUA = ua.includes("mac os x") || ua.includes("macintosh");
  const isWinUA = ua.includes("windows");
  const isLinuxUA = ua.includes("linux") && !ua.includes("android");

  const isMac = osOverride === "mac" ? true : osOverride === "win" || osOverride === "linux" ? false : isMacUA;
  const isWin = osOverride === "win" ? true : osOverride === "mac" || osOverride === "linux" ? false : isWinUA;
  const isLinux = osOverride === "linux" ? true : osOverride === "mac" || osOverride === "win" ? false : isLinuxUA;

  // Files placed under /static/installers/
  const macUrl = "/static/installers/itam-agent-mac-dev.pkg";
  const winUrl = "/static/installers/itam-agent-win.exe";
  const linuxUrl = `/enroll/linux-installer?token=${token}`;
  const linuxScriptUrl = "/static/installers/itam-agent-linux-gui.sh";
  const linuxCliUrl = "/static/installers/itam-agent-linux.sh";

  const primaryUrl = isMac ? macUrl : isLinux ? linuxUrl : winUrl;
  const primaryLabel = isMac
    ? "Download for macOS (.pkg)"
    : isLinux
    ? "Download Auto-Installer (.sh)"
    : "Download for Windows (.exe)";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ITAM Agent Enrollment</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root{color-scheme:dark}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:2rem;background:#0b1220;color:#e6edf3}
    .card{max-width:720px;margin:0 auto;background:#111827;border:1px solid #263043;border-radius:16px;padding:1.5rem;box-shadow:0 10px 30px rgba(0,0,0,0.25)}
    h1{font-size:1.4rem;margin:0 0 .5rem}
    p{opacity:.9;line-height:1.6}
    .actions{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem}
    a.btn{display:inline-block;padding:.75rem 1rem;border-radius:10px;border:1px solid #304156;text-decoration:none;color:#e6edf3}
    a.btn.primary{background:#1f6feb;border-color:#1f6feb}
    small{opacity:.75}
    code{background:#0d1626;padding:.2rem .35rem;border-radius:6px}
    .hint{margin-top:.75rem;color:#9fb3c8}
    .install-note{margin-top:1rem;padding:1rem;background:#0d1626;border-radius:8px;border-left:3px solid #1f6feb}
    .install-note code{background:#111827}
    .token-info{background:#1e3a5f;border:1px solid #2563eb;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.9rem}
    .token-info strong{color:#60a5fa}
  </style>
</head>
<body>
  <div class="card">
    <div class="token-info">
      <strong>Enrollment Token:</strong> ${enrollmentToken.name || 'Device Enrollment'}
    </div>
    <h1>Install ITAM Agent</h1>
    <p>This will install the agent and register your device with the IT Asset Management system.</p>

    <div class="actions">
      <a class="btn primary" id="primary" href="${primaryUrl}">${primaryLabel}</a>
      <a class="btn" href="${winUrl}">Windows (.exe)</a>
      <a class="btn" href="${macUrl}">macOS (.pkg)</a>
      <a class="btn" href="${linuxUrl}">Linux (GUI)</a>
      <a class="btn" href="${linuxCliUrl}">Linux (CLI)</a>
    </div>

    <p class="hint"><small>The download should start automatically. If not, click the button above.</small></p>
    ${isLinux ? `
    <div class="install-note" style="background:#0d1929;border-left:3px solid #2ea043;padding:1.5rem;">
      <h3 style="margin-top:0;color:#58a6ff;font-size:1.2rem;">📋 Register Your Linux Device</h3>
      <p style="margin:0.75rem 0;line-height:1.6;">The audit script has been downloaded. Run this command in your terminal to register your device:</p>

      <div style="margin:1rem 0;padding:1rem;background:#0b1220;border-radius:8px;border:2px solid #1f6feb;">
        <code id="installCmd" style="display:block;color:#7ee787;font-size:15px;font-family:'Courier New',monospace;user-select:all;font-weight:500;">cd ~/Downloads && sudo bash audit_linux.sh</code>
      </div>

      <button onclick="copyInstallCmd()" style="padding:0.75rem 1.5rem;background:#2ea043;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;box-shadow:0 4px 6px rgba(0,0,0,0.2);">
        📋 Copy Command
      </button>

      <div style="margin-top:1.5rem;padding:1rem;background:#0b1220;border-radius:6px;border:1px solid #21262d;">
        <p style="margin:0 0 0.5rem;font-weight:600;color:#e6edf3;">ℹ️ What happens:</p>
        <ol style="margin:0.5rem 0 0 1.25rem;padding:0;line-height:1.8;opacity:0.9;">
          <li>Script collects device hardware and software information</li>
          <li>Device is automatically registered in the ITAM system</li>
          <li>View and manage your device in the Assets dashboard</li>
          <li>Asset information updates automatically</li>
        </ol>
      </div>
    </div>
    <script>
      function copyInstallCmd() {
        const cmd = document.getElementById('installCmd').textContent;
        navigator.clipboard.writeText(cmd).then(() => {
          event.target.textContent = '✅ Copied! Paste in your terminal';
          setTimeout(() => { event.target.textContent = '📋 Copy Command'; }, 3000);
        });
      }
    </script>
    ` : '<p class="hint"><small>No terminal or VPN required.</small></p>'}
    <p class="hint"><small>Tip: append <code>?os=mac</code>, <code>?os=win</code>, or <code>?os=linux</code> to test platform detection.</small></p>
  </div>

  <script>
    // Auto-trigger the primary download after a short delay
    setTimeout(function(){
      var a = document.getElementById('primary');
      if (a && a.href) window.location.href = a.href;
    }, 1000);
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});

export default router;
