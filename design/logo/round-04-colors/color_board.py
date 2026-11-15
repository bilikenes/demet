"""Palette review sheet; display framing only, full-resolution sources preserved."""
from pathlib import Path
import importlib.util
import json
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('concept_board',ROOT.parent/'round-01'/'concept_board.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
meta=json.loads((ROOT/'colors.json').read_text(encoding='utf-8'))
board=Image.new('RGB',(2280,1110),'#F5F4F0')
d=ImageDraw.Draw(board)
def font(n,bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if bold else 'segoeui.ttf'),n)
d.text((78,58),'Demetçi Maymun / zemin rengi çalışmaları',font=font(46,True),fill='#171A19')
d.text((78,127),'Onaylanan A karakteri · Siyah–fildişi gravür · Dört farklı renk',font=font(25),fill='#666B67')
d.line((78,188,2202,188),fill='#DADDD7',width=2)
for i,c in enumerate(meta['colors']):
    x=78+i*540
    if i: d.line((x-25,222,x-25,1008),fill='#DADDD7',width=1)
    d.text((x,222),f'{i+1:02d} / {c["name"]}',font=font(30,True),fill='#171A19')
    label='MEVCUT RENK' if i==0 else c['hex']
    d.text((x,270),label,font=font(19),fill='#666B67')
    with Image.open(ROOT/(c['id']+'.png')) as raw:
        im=raw.convert('RGBA')
        im=im.crop((8,8,im.width-8,im.height-8))
        im=module.rounded_alpha(im,.28)
    large=im.resize((480,480),Image.Resampling.LANCZOS)
    board.paste(large,(x+7,320),large)
    notes=module.wrap_text(d,c['note'],font(22),490)
    for j,line in enumerate(notes[:2]): d.text((x,818+j*29),line,font=font(22),fill='#666B67')
    d.line((x,893,x+490,893),fill='#DADDD7',width=1)
    d.text((x,926),'GERÇEK BOYUT',font=font(17,True),fill='#666B67')
    sx=x+166
    for n in (64,32,16):
        icon=im.resize((n,n),Image.Resampling.LANCZOS)
        board.paste(icon,(sx,908+(64-n)//2),icon)
        d.text((sx,984),f'{n}px',font=font(16),fill='#666B67')
        sx+=n+35
d.line((78,1040,2202,1040),fill='#DADDD7',width=2)
d.text((78,1061),'RENK KARŞILAŞTIRMASI / PAKETLEME ÖNCESİ',font=font(18,True),fill='#666B67')
d.text((1740,1061),'01 TURKUAZ · 02 AMBER · 03 MAVİ · 04 MERCAN',font=font(17),fill='#666B67')
board.save(ROOT/'colors.png',optimize=True)
print(ROOT/'colors.png')
