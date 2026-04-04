/**
 * One-time helper to obtain a TikTok refresh token via the OAuth 2.0 PKCE flow.
 *
 * Usage:
 *   1. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in your .env
 *   2. Run:  npx tsx src/publish/tiktok-auth.ts
 *   3. Open the printed URL in a browser, authorise as @SignalDrop
 *   4. Copy the `code` query param from the redirect URL and paste it back
 *   5. The script prints TIKTOK_REFRESH_TOKEN — save it in .env
 *
 * Scopes requested: video.publish  (direct post, no inbox draft)
 * Add  video.upload  if you want the draft-to-inbox flow instead.
 *
 * Redirect URI: must exactly match one registered on the TikTok Developer Portal.
 * For local use, register: https://localhost:8080/callback
 */

import { createInterface } from "readline";
import { loadConfig } from "../config.js";

const REDIRECT_URI = "https://localhost:8080/callback";
const SCOPES = ["video.publish", "user.info.basic"].join(",");
const AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.tikTokClientKey || !config.tikTokClientSecret) {
    console.error(
      "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env first."
    );
    process.exit(1);
  }

  // Build the auth URL
  const params = new URLSearchParams({
    client_key: config.tikTokClientKey,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state: crypto.randomUUID()
  });

  const authUrl = `${AUTH_BASE}?${params.toString()}`;
  console.log("\n1. Open this URL in a browser and authorise as @SignalDrop:");
  console.log(`\n   ${authUrl}\n`);

  const code = await prompt(
    "2. Paste the `code` value from the redirect URL here: "
  );

  if (!code) {
    console.error("No code provided.");
    process.exit(1);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: config.tikTokClientKey,
      client_secret: config.tikTokClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI
    })
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Token exchange failed (${res.status}): ${body}`);
    process.exit(1);
  }

  const json = (await res.json()) as {
    data: { access_token: string; refresh_token: string; expires_in: number };
  };
  const { refresh_token } = json.data;

  console.log("\n3. Add this to your .env:");
  console.log(`\n   TIKTOK_REFRESH_TOKEN=${refresh_token}\n`);
  console.log(
    "Refresh tokens are long-lived (~365 days). Rotate if revoked or expired."
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
