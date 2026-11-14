# Demet

Birlikte kullandığın uygulamaları, klasörleri ve web sitelerini bir **demet** altında toplayıp tek bir kısayolla
sırayla açan hafif Windows aracı. Tauri 2 (Rust) + React + Amber UI.

## Kurulum

[Releases](https://github.com/bilikenes/demet/releases/latest) sayfasından `Demet_x.y.z_x64-setup.exe` dosyasını
indirip çalıştır. Yönetici izni gerekmez. Kurulduktan sonra uygulama güncellemeleri kendisi bulur ve
imzasını doğrulayarak kurar.

## Geliştirme

```bash
npm install
npm run tauri:dev     # geliştirme (sıcak yenileme)
npm run tauri:build   # Windows yükleyicisi (NSIS); imza anahtarı gerekir, bkz. RELEASING.md
npm run check:ui      # Amber UI kural denetimi
cd src-tauri && cargo test --lib
```

- `src-tauri/src/` — Rust arka ucu: `triggers` (global kısayol + fare kancası), `launcher`, `discovery`, `winutil` (Win32), `favicon`, `tray`, `overlay`, `config`.
- `src/` — arayüz. `src/ui/` Amber UI tasarım sistemidir, projeye özel değiştirilmez.
- Yapılandırma `%APPDATA%\Demet\config.json`.

## Sürüm çıkarma

```bash
npm run release -- 0.2.0      # sürümü günceller, commit + tag atar
git push --follow-tags        # GitHub Actions derler, imzalar, taslak Release oluşturur
```

Ayrıntılar ve bir kerelik kurulum: [RELEASING.md](RELEASING.md).
