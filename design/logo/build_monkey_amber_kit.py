"""Reproduce the approved Demet raster icon package using the skill exporter."""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import struct
import subprocess
import sys
import zipfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'demet-monkey-amber-icon-kit'
SOURCE = ROOT / 'round-04-colors' / '02-amber.png'
EXPORTER = Path('C:/Users/PC/.codex/skills/engraved-logo-design/scripts/export_kit.py')
BG = '#F49F20'
SIZES = (16,20,24,32,40,48,64,96,128,180,192,256,512,1024)


def main():
    if OUT.exists() and ((OUT / 'demet-monkey-amber-icon-kit.zip').exists() or not (OUT / 'metadata.json').exists()):
        raise SystemExit('Output already exists. Preserve it and choose a new output directory.')
    (OUT / 'source').mkdir(parents=True, exist_ok=True)
    original = OUT / 'source' / 'approved-original-1254.png'
    shutil.copy2(SOURCE, original)
    spec = importlib.util.spec_from_file_location('engraved_export', EXPORTER)
    exporter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(exporter)
    with Image.open(SOURCE) as im:
        # Remove only the 8px external generation mat, then normalize corner alpha.
        source = im.convert('RGBA').crop((8,8,im.width-8,im.height-8))
    source = exporter.rounded_alpha(source, .28)
    prepared = OUT / 'source' / 'production-master-1238.png'
    source.save(prepared, optimize=True)
    subprocess.run([
        sys.executable, str(EXPORTER), str(prepared), '--name','Demet',
        '--bg',BG,'--out-dir',str(OUT),'--corner-mode','keep','--icns','--no-zip'
    ], check=True)

    # Keep the complete illustration inside the PWA maskable circular safe area.
    safe = Image.new('RGBA',(512,512),BG)
    safe.alpha_composite(source.resize((336,336),Image.Resampling.LANCZOS),(88,88))
    safe.save(OUT / 'web' / 'maskable-icon-512.png', optimize=True)

    # Lanczos can leave a near-transparent 3/255 alpha at the 20px outer corners.
    # Make just the four exterior corner pixels fully transparent on PNG outputs.
    for p in OUT.rglob('*.png'):
        if p == original or p.name == 'maskable-icon-512.png':
            continue
        with Image.open(p) as im:
            im = im.convert('RGBA')
        changed = False
        for xy in ((0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)):
            rgba = im.getpixel(xy)
            if rgba[3] != 0:
                im.putpixel(xy,rgba[:3]+(0,))
                changed = True
        if changed:
            im.save(p,optimize=True)

    # Convenience names match the existing project's Tauri configuration.
    tauri = OUT / 'tauri'
    tauri.mkdir(exist_ok=True)
    for size, name in ((32,'32x32.png'),(64,'64x64.png'),(128,'128x128.png'),(256,'128x128@2x.png'),(1024,'icon.png')):
        shutil.copy2(OUT / 'png' / f'icon-{size:04d}.png',tauri / name)
    shutil.copy2(OUT / 'windows' / 'app.ico',tauri / 'icon.ico')
    if (OUT / 'mac' / 'app.icns').exists():
        shutil.copy2(OUT / 'mac' / 'app.icns',tauri / 'icon.icns')

    images = {n:Image.open(OUT / 'png' / f'icon-{n:04d}.png').convert('RGBA') for n in SIZES}
    preview = Image.new('RGB',(1420,800),'#F5F4F0')
    draw = ImageDraw.Draw(preview)
    title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',34)
    label = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
    draw.text((60,30),'Demet / Amber maymun logo paketi',font=title,fill='#171A19')
    draw.text((60,82),'Çiçek demeti taşıyan kapuçin maymunu · Gerçek piksel boyutları · Şeffaf köşeler',font=label,fill='#626963')
    draw.line((60,120,1360,120),fill='#D6DBD5',width=1)
    left = 65
    for n in (512,256,128,64,32,16):
        preview.paste(images[n],(left,145+(512-n)//2),images[n])
        draw.text((left,680),f'{n} px',font=label,fill='#626963')
        left += n+30
    draw.text((60,740),'PNG 16–1024  /  Windows ICO  /  macOS ICNS  /  Favicon ve PWA',font=label,fill='#626963')
    preview.save(OUT / 'export-preview.png',optimize=True)

    readme = '''DEMET — AMBER MAYMUN / ONAYLANAN LOGO PAKETİ

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
'''
    (OUT / 'README.txt').write_text(readme,encoding='utf-8')

    checks = {'png_dimensions':{},'ico_layers':{},'icns_frames':[], 'corner_alpha':True,'maskable_opaque':True,'manifest_files_exist':True}
    for n, im in images.items():
        assert im.size == (n,n)
        assert im.getchannel('A').getpixel((0,0)) == 0
        assert im.getchannel('A').getpixel((n-1,n-1)) == 0
        checks['png_dimensions'][str(n)] = list(im.size)
    for rel, expected in [('windows/app.ico',[16,24,32,48,64,128,256]),('web/favicon.ico',[16,32,48])]:
        data = (OUT / rel).read_bytes()
        reserved,kind,count = struct.unpack_from('<HHH',data)
        assert reserved == 0 and kind == 1 and count == len(expected)
        with Image.open(OUT / rel) as ico:
            sizes = sorted(w for w,h in ico.ico.sizes())
            assert sizes == expected
            for n in expected:
                frame = ico.ico.getimage((n,n))
                frame.load()
                assert frame.size == (n,n)
        checks['ico_layers'][rel] = expected
    with Image.open(OUT / 'mac' / 'app.icns') as icns:
        for size in icns.info['sizes']:
            icns.size = size
            icns.load()
            checks['icns_frames'].append(list(size))
    assert safe.getchannel('A').getextrema() == (255,255)
    # Every visible pixel of the inner tile lies within the 40%-radius safe circle.
    alpha = source.resize((336,336),Image.Resampling.LANCZOS).getchannel('A')
    max_radius = max(((x+88-255.5)**2+(y+88-255.5)**2)**.5 for y in range(336) for x in range(336) if alpha.getpixel((x,y)) > 0)
    assert max_radius < 512*.4
    checks['maskable_max_content_radius_px'] = round(max_radius,2)
    manifest = json.loads((OUT / 'web' / 'site.webmanifest').read_text(encoding='utf-8'))
    for item in manifest['icons']:
        assert (OUT / 'web' / item['src']).is_file()
    for p in OUT.rglob('*.png'):
        with Image.open(p) as im:
            im.verify()
    checks['status'] = 'passed'
    (OUT / 'validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
    metadata = json.loads((OUT / 'metadata.json').read_text(encoding='utf-8'))
    metadata.update({
        'source':'source/production-master-1238.png',
        'approved_original':'source/approved-original-1254.png',
        'approved_original_dimensions':[1254,1254],
        'approved_original_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'production_crop_px_per_edge':8,
        'production_corner_radius_fraction':.28,
        'foreground_palette':['dark ink','ivory'],
        'approved_character':'Demetçi Maymun / white-faced capuchin',
        'approved_color':'Amber',
        'requested_background_hex':'#F5A524',
        'sampled_background_hex':BG,
        'approval':'Kullanıcı: Amber ile ilerleyelim, paketleyebilirsin',
        'true_vector_master':False,
        'maskable_content_size':336,
        'micro_master_used':False,
        'validation':'validation.json'
    })
    files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file())
    metadata['files'] = files
    metadata['sha256'] = {rel:hashlib.sha256((OUT / rel).read_bytes()).hexdigest() for rel in files if rel != 'metadata.json'}
    (OUT / 'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    archive = OUT / 'demet-monkey-amber-icon-kit.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for rel in files:
            z.write(OUT / rel,arcname=rel)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert sorted(z.namelist()) == files
    print(json.dumps({'status':'passed','files':len(files),'archive':str(archive),'archive_bytes':archive.stat().st_size,'maskable_max_radius':max_radius},ensure_ascii=False))


if __name__ == '__main__':
    main()
