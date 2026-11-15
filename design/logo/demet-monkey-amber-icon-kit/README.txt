DEMET — AMBER MAYMUN / ONAYLANAN LOGO PAKETİ

master-1024.png: 1024×1024 RGBA ana çıktı.
source/approved-original-1254.png: onaylanan, değiştirilmemiş 1254×1254 kaynak.
source/production-master-1238.png: dıştaki 8px siyah pay çıkarılmış, köşeleri şeffaf üretim kaynağı.
png/: 16, 20, 24, 32, 40, 48, 64, 96, 128, 180, 192, 256, 512 ve 1024px.
windows/app.ico: 16, 24, 32, 48, 64, 128, 256px katmanlı Windows ikonu.
mac/app.icns: macOS ikonu.
web/: favicon ICO/PNG, Apple touch icon, PWA ikonları, manifest ve HTML örneği.
tauri/: mevcut proje yapılandırmasıyla uyumlu dosya adları.
export-preview.png: gerçek boyutlarda önizleme.
validation.json: dosya bütünlüğü ve boyut kontrolleri.
metadata.json: kaynak, renk, şeffaflık ve SHA-256 bilgileri.

TAURI KULLANIMI
tauri/ içindeki dosyalar gerektiğinde src-tauri/icons/ klasörüne kopyalanabilir.
Bu paket üretimi mevcut uygulama ikonlarını veya uygulama kodunu değiştirmez.

WEB KULLANIMI
web/ dosyalarını birlikte barındırın; web/head-snippet.html bağlantı örneğidir.
Maskable PWA dosyası tam opaktır; çizim, merkezdeki dairesel güvenli bölgededir.

RENK VE KAYNAK
Zemin: amber; seçilen renk hedefi #F5A524. Web alanı için onaylı rasterden örneklenen #F49F20 kullanıldı.
Çizim: koyu mürekkep ve fildişi.
Tüm boyutlar en yüksek çözünürlüklü üretim kaynağından Lanczos ile küçültüldü.
1024px çıktı büyütülmedi. Aynı çizim tüm boyutlarda korundu.
16px seviyesinde ince gravür detayları doğal olarak azalır; ayrı mikro çizim kullanılmadı.
Bu paket rasterdir; düzenlenebilir gerçek vektör/SVG içermez.
