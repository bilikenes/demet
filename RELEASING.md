# Sürüm çıkarma

## Nasıl çalışıyor

```
npm run release -- 0.2.0  →  git push --follow-tags  →  GitHub Actions derler + imzalar
        →  taslak Release (setup.exe + latest.json)  →  sen "Publish" dersin  →  uygulamalar güncellemeyi görür
```

- Kurulu uygulamalar açıldıktan ~4 sn sonra, sonra da her 6 saatte bir (Demet tepside günlerce açık kalır)
  `https://github.com/bilikenes/demet/releases/latest/download/latest.json` adresine bakar.
- `latest.json` içindeki imza, `tauri.conf.json > plugins.updater.pubkey` ile doğrulanır. İmzası tutmayan
  hiçbir güncelleme kurulmaz. `requireSignedVersion` açık: imza, hangi sürüm için atıldığını da taşır, bu yüzden
  eski ama geçerli imzalı bir sürüme düşürme (downgrade) saldırısı da reddedilir.
- Sürüm numarasının tek kaynağı `package.json` (`tauri.conf.json` oradan okur). `npm run release` betiği
  `Cargo.toml`/`Cargo.lock`/`package-lock.json`'ı da eşitler.
- Uygulamada: yeni sürüm varsa sayfanın üstünde bir bildirim ve kenar çubuğunda "Güncelleme" rozeti çıkar;
  **Ayarlar → Güncellemeler** kartından elle denetlenip kurulabilir. Kurulum sessizce (passive) yapılır ve
  Demet yeniden açılır.

## Bir kerelik kurulum

### 1. İmza anahtarını GitHub'a ekle

Anahtar çifti bu bilgisayarda üretildi:

| Dosya | Ne |
|---|---|
| `%USERPROFILE%\.tauri\demet.key` | **Özel anahtar** — gizli, repoya asla girmez |
| `%USERPROFILE%\.tauri\demet.key.pub` | Açık anahtar — `tauri.conf.json` içinde zaten var |

Özel anahtarı repo secret'ı olarak ekle:

```bash
# Git Bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/demet.key
```

```powershell
# PowerShell
Get-Content "$env:USERPROFILE\.tauri\demet.key" -Raw | gh secret set TAURI_SIGNING_PRIVATE_KEY
```

Ya da GitHub'da: **Settings → Secrets and variables → Actions → New repository secret**,
ad `TAURI_SIGNING_PRIVATE_KEY`, değer `demet.key` dosyasının içeriği.

Anahtarın parolası yok, bu yüzden `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret'ı gerekmez.

### 2. Anahtarı yedekle

`demet.key` dosyasını bir parola yöneticisine veya şifreli bir yedeğe koy. **Kaybolursa mevcut kullanıcılara bir
daha güncelleme gönderilemez** — yeni anahtarla imzalanan sürümleri eski kurulumlar reddeder, herkesin yeni sürümü
elle indirmesi gerekir.

## Her sürümde

1. `main` dalında, temiz bir çalışma alanıyla:
   ```bash
   npm run release -- 0.2.0
   ```
   Betik sürümü günceller, `Release v0.2.0` commit'ini ve `v0.2.0` tag'ini oluşturur. Push etmez.
2. Yayınla:
   ```bash
   git push --follow-tags
   ```
3. **Actions** sekmesinde *Release* iş akışının bitmesini bekle (~10 dk).
4. **Releases** sayfasındaki taslağı aç: *Değişiklikler* bölümünü doldur, `Demet_0.2.0_x64-setup.exe` ve
   `latest.json` dosyalarının yüklendiğini kontrol et, **Publish release** de.

Yayınlanana kadar taslak, kullanıcılara görünmez ve güncelleme olarak sunulmaz.

> İlk yayın: depo `0.0.0` sürümünde başlar. İlk sürüm için `npm run release -- 0.1.0` çalıştır.

## Yerelde imzalı derleme (isteğe bağlı)

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/demet.key)" npm run tauri:build
```

`createUpdaterArtifacts` açık olduğu için imza anahtarı olmadan `tauri build` imza adımında hata verir; yerelde
sadece denemek istiyorsan yukarıdaki gibi anahtarı ver. Çıktı: `src-tauri/target/release/bundle/nsis/`.

## Güncelleme arayüzünü önizleme (geliştirme)

Tarayıcıda `npm run dev` ile açıp adrese `?update=available`, `?update=downloading`, `?update=latest` veya
`?update=error` ekle; gerçek sürüm yayınlamadan arayüzün her durumunu görebilirsin. Yalnızca geliştirmede çalışır.

## Kod imzalama (henüz yok)

Kurulum dosyası Authenticode ile imzalı değil; Windows SmartScreen ilk sürümlerde "Bilinmeyen yayımcı" uyarısı
gösterir. Kaldırmak için bir kod imzalama hizmeti (ör. Azure Trusted Signing) gerekir — ücretli, ayrı bir karar.
