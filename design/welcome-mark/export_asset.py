"""Export the generated transparent UI mark; preserve the original artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
source=Image.open(ROOT/'master.png').convert('RGBA')
# Ignore imperceptible alpha noise when measuring the ink's visual bounds.
bounds=source.getchannel('A').point(lambda n:255 if n>8 else 0).getbbox()
crop=source.crop(bounds)
pad=round(max(crop.size)*.025)
side=max(crop.size)+pad*2
master=Image.new('RGBA',(side,side))
master.alpha_composite(crop,((side-crop.width)//2,(side-crop.height)//2))
master.save(ROOT/'centered-master.png',optimize=True)
asset=ROOT.parent.parent/'public'/'welcome-monkey.png'
master.resize((256,256),Image.Resampling.LANCZOS).save(asset,optimize=True)

board=Image.new('RGB',(960,420),'#F5F4F0')
d=ImageDraw.Draw(board)
f=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',22)
b=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',30)
d.text((38,24),'Demet / sade karşılama işareti',font=b,fill='#17150F')
d.text((38,74),'Şeffaf zemin · Maymun ve çiçek demeti · Sarı kutu içinde kullanım',font=f,fill='#666B67')
for x,n in ((44,224),(352,128),(566,64)):
    tile=Image.new('RGBA',(n,n))
    ImageDraw.Draw(tile).rounded_rectangle((0,0,n-1,n-1),radius=round(n*.375),fill='#F5A524')
    mark_size=round(n*.75)
    alpha=master.resize((mark_size,mark_size),Image.Resampling.LANCZOS).getchannel('A')
    ink=Image.new('RGBA',alpha.size,'#17150F')
    ink.putalpha(alpha)
    tile.alpha_composite(ink,((n-mark_size)//2,(n-mark_size)//2))
    board.paste(tile,(x,148+(224-n)//2),tile)
    d.text((x,382),f'{n}px kutu',font=f,fill='#666B67')
board.save(ROOT/'preview.png',optimize=True)
print({'visual_bounds':bounds,'source':source.size,'centered':master.size,'runtime':str(asset)})
