export function nightlyCleanupPlist(opts: {
  label: string;
  bunPath: string;
  entryPath: string;
  logDir: string;
  hour: number;
  minute: number;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>${opts.label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${opts.bunPath}</string>
        <string>${opts.entryPath}</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key><integer>${opts.hour}</integer>
        <key>Minute</key><integer>${opts.minute}</integer>
    </dict>
    <key>StandardOutPath</key><string>${opts.logDir}/nightly.out.log</string>
    <key>StandardErrorPath</key><string>${opts.logDir}/nightly.err.log</string>
    <key>RunAtLoad</key><false/>
    <key>KeepAlive</key><false/>
</dict>
</plist>
`;
}
