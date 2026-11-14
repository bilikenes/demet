# Demet

Uygulama demetlerini (uygulama, klasör, web adresi listesi) tek kısayolla başlatan Windows aracı.
Tauri 2 (Rust) + React + Amber UI.

```bash
npm install
npm run tauri:dev     # geliştirme (sıcak yenileme)
npm run tauri:build   # Windows yükleyicisi (NSIS)
npm run check:ui      # Amber UI kural denetimi
cd src-tauri && cargo test --lib
```

- `src-tauri/src/` — Rust arka ucu: `triggers` (global kısayol + fare kancası), `launcher`, `discovery`, `winutil` (Win32), `tray`, `overlay`, `config`.
- `src/` — arayüz. `src/ui/` Amber UI tasarım sistemidir, projeye özel değiştirilmez.
- Yapılandırma `%APPDATA%\Demet\config.json`: eski WPF sürümüyle aynı dosya ve uyumlu biçim.
