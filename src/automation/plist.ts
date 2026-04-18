import { homedir } from "node:os";
import { resolve } from "node:path";

export const AGENT_LABEL = "codes.photon.agent";

export function buildInvocation(): string[] {
  const runner = process.execPath;
  const script = process.argv[1];
  if (script && script.endsWith(".ts")) {
    return [runner, "run", resolve(script), "serve"];
  }
  return [runner, "serve"];
}

export function renderPlist(logsDir: string): string {
  const args = buildInvocation().map((token) => `    <string>${escape(token)}</string>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${escape(logsDir)}/photon.out.log</string>
  <key>StandardErrorPath</key>
  <string>${escape(logsDir)}/photon.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${escape(homedir())}</string>
  </dict>
</dict>
</plist>
`;
}

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
