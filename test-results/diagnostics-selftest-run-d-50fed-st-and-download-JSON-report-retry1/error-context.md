# Page snapshot

```yaml
- alert [ref=e3]:
  - generic [ref=e4]:
    - img "Antiphon Studios" [ref=e5]
    - heading "Hub startup failed" [level=1] [ref=e6]
    - paragraph [ref=e7]: This Hub runs as a desktop app. You are viewing the web dev server without the desktop bridge.
    - generic [ref=e8]: "Code: TAURI_UNAVAILABLE"
    - group [ref=e9]:
      - generic "Details" [ref=e10] [cursor=pointer]
    - list [ref=e11]:
      - listitem [ref=e12]: "Run: pnpm dev:server"
      - listitem [ref=e13]: "Run: pnpm --filter @antiphon/hub tauri:dev"
      - listitem [ref=e14]: In dev, enable mock mode and retry.
    - generic [ref=e15]:
      - button "Enable Mock Mode (dev)" [ref=e16]
      - button "Retry bootstrap" [ref=e17]
      - button "How to run" [ref=e18]
    - generic [ref=e19]: Web dev only. Disables desktop commands.
    - generic [ref=e20]:
      - button "Open logs" [ref=e21]
      - button "Export support bundle" [ref=e22]
    - generic [ref=e23]: "Logs are stored at: ~/Library/Application Support/com.Antiphon.Hub/logs"
```