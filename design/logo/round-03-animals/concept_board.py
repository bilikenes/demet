#!/usr/bin/env python3
"""Create ONE polished A/B/C comparison board from three separate raster app-icon masters.

Usage:
 python scripts/concept_board.py a.png b.png c.png --names 'A name' 'B name' 'C name' \
   --notes 'Rationale A' 'Rationale B' 'Rationale C' --recommend 2 -o concepts.png

Pillow >=10 required. The originals are never modified.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageChops

BG = '#F5F4F0'
INK = '#171A19'
MUTED = '#666B67'
HAIR = '#DADDD7'


def font(size:int, heavy:bool=False):
    choices = (
      ['/usr/share/fonts/truetype/inter/Inter-Bold.otf', '/usr/share/fonts/opentype/inter/Inter-Bold.otf',
       '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'C:/Windows/Fonts/segoeuib.ttf']
      if heavy else
      ['/usr/share/fonts/truetype/inter/Inter-Regular.otf', '/usr/share/fonts/opentype/inter/Inter-Regular.otf',
       '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:/Windows/Fonts/segoeui.ttf']
    )
    for item in choices:
        try: return ImageFont.truetype(item, size)
        except OSError: pass
    return ImageFont.load_default()


def rounded_alpha(im:Image.Image, radius_fraction:float):
    """Remove dark corners commonly baked into generated app-icon RGB artwork."""
    im = im.convert('RGBA')
    ss = 2
    mask = Image.new('L', (im.width*ss, im.height*ss), 0)
    r = int(min(im.size)*radius_fraction*ss)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,im.width*ss-1,im.height*ss-1), radius=r, fill=255)
    mask = mask.resize(im.size, Image.Resampling.LANCZOS)
    im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
    return im


def wrap_text(draw, text, fnt, limit):
    words = text.split(); lines=[]; cur=''
    for w in words:
        candidate = f'{cur} {w}' if cur else w
        if draw.textbbox((0,0),candidate,font=fnt)[2] > limit and cur:
            lines.append(cur); cur=w
        else: cur=candidate
    if cur: lines.append(cur)
    return lines


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('images', nargs=3, help='exactly three 1:1 raster masters')
    ap.add_argument('--names', nargs=3, default=['Direct', 'Metaphor', 'Wildcard'])
    ap.add_argument('--notes', nargs=3, default=['Direct meaning.', 'Creative metaphor.', 'Unexpected interpretation.'])
    ap.add_argument('--title', default='Three logo directions')
    ap.add_argument('--subtitle', default='Explore the ideas. Choose one direction to refine.')
    ap.add_argument('--recommend',type=int,choices=[1,2,3],default=None)
    ap.add_argument('--corner-radius',type=float,default=.22,help='rounded icon mask as fraction of icon width; 0 to disable')
    ap.add_argument('--out','-o',default='concepts.png')
    a=ap.parse_args()

    W,H=1950,1080
    margin,gap=94,58
    panelw=(W-2*margin-2*gap)//3
    img_size=476
    board=Image.new('RGB',(W,H),BG)
    d=ImageDraw.Draw(board)
    font_title=font(48,True); font_small=font(24); font_label=font(30,True); font_note=font(21)
    font_caps=font(17,True); font_scale=font(15)
    d.text((margin,68),a.title,fill=INK,font=font_title)
    d.text((margin,135),a.subtitle,fill=MUTED,font=font_small)
    d.line((margin,196,W-margin,196), fill=HAIR,width=2)

    for i,src in enumerate(a.images):
        x=margin+i*(panelw+gap)
        center=x+panelw//2
        yy=225
        if i:
            sep=x-gap//2
            d.line((sep,225,sep,980),fill=HAIR,width=2)
        d.text((x,227),f'{chr(ord("A")+i)} / 0{i+1}', fill=MUTED,font=font_caps)
        d.text((x,269), a.names[i],fill=INK,font=font_label)
        if a.recommend==i+1:
            bb=d.textbbox((0,0),'ÖNERİLEN YÖN',font=font_caps)
            d.text((x+panelw-(bb[2]-bb[0]),239),'ÖNERİLEN YÖN',fill='#444945',font=font_caps)

        with Image.open(src) as im:
            im=im.convert('RGBA')
            inset=8
            im=im.crop((inset,inset,im.width-inset,im.height-inset))
            if a.corner_radius>0: im=rounded_alpha(im,a.corner_radius)
            source=im.copy()
            im=ImageOps.fit(im,(img_size,img_size),method=Image.Resampling.LANCZOS)
            if a.corner_radius>0: im=rounded_alpha(im,a.corner_radius)
            bx=center-img_size//2
            board.paste(im,(bx,330),im)
            # Keep true pixel-size previews, not enlarged thumbnails.
            d.line((x,849,x+panelw,849),fill=HAIR,width=1)
            d.text((x,876),'GERÇEK BOYUT',fill=MUTED,font=font_caps)
            sx=x+170
            for n in (64,32,16):
                pix=source.resize((n,n),Image.Resampling.LANCZOS)
                board.paste(pix,(sx,858+(64-n)//2),pix)
                d.text((sx,931),f'{n}px',fill=MUTED,font=font_scale)
                sx+=n+40

        wrapped=wrap_text(d,a.notes[i],font_note,panelw-12)
        for j,line in enumerate(wrapped[:2]):
            d.text((x,806+j*28),line,fill=MUTED,font=font_note)

    d.line((margin,994,W-margin,994),fill=HAIR,width=2)
    d.text((margin,1016),'GRAVÜR UYGULAMA İKONLARI  /  KONSEPT İNCELEMESİ',fill=MUTED,font=font_caps)
    d.text((W-margin-327,1016),'TUR 01  —  A / B / C SEÇİMİ',fill=MUTED,font=font_caps)
    out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
    board.save(out, 'PNG', optimize=True)
    print(f'Created {out} ({W}x{H}). Show this single board and STOP for a choice.')

if __name__=='__main__': main()
