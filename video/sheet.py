import sys, json, os
from PIL import Image, ImageDraw, ImageFont
d, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
times = json.load(open(f'{d}/times.json'))
cols = 5 if H > W else 5; tw = 300; th = int(tw * H / W); pad = 16; lab = 34
rows = (len(times) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad + 50), (27, 42, 74))
dr = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype(os.path.expanduser('~/.fonts/inter-latin-600-normal.ttf'), 20); ft = ImageFont.truetype(os.path.expanduser('~/.fonts/inter-latin-700-normal.ttf'), 26)
except Exception: f = ft = None
dr.text((pad, 12), f'Tabatha showreel  {W}x{H}  one frame per beat (120 BPM)', fill=(255, 209, 102), font=ft)
for i, t in enumerate(times):
    im = Image.open(f'{d}/{i:04d}.png').convert('RGB').resize((tw, th), Image.LANCZOS)
    x = pad + (i % cols) * (tw + pad); y = 50 + pad + (i // cols) * (th + lab + pad)
    sheet.paste(im, (x, y + lab)); dr.text((x, y + 6), f'beat {i + 1}  ·  {t:.2f}s', fill=(255, 248, 231), font=f)
os.makedirs('out', exist_ok=True); p = f'out/contact-sheet-{W}x{H}.png'; sheet.save(p); print('wrote', p, sheet.size)
