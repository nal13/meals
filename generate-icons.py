"""
Gera icon-192.png e icon-512.png para a PWA.
Requer apenas a biblioteca padrao do Python.
Corre: python generate-icons.py
"""
import struct, zlib, math, os

def make_png(size, draw_pixel):
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    raw = b''
    for y in range(size):
        raw += b'\x00'
        for x in range(size):
            r, g, b = draw_pixel(x, y)
            raw += bytes([r, g, b])
    idat = zlib.compress(raw, 9)
    return (b'\x89PNG\r\n\x1a\n' +
            chunk(b'IHDR', ihdr) +
            chunk(b'IDAT', idat) +
            chunk(b'IEND', b''))

def make_icon_pixel(size):
    cx = cy = (size - 1) / 2.0
    outer_r = size * 0.38
    inner_r = size * 0.24
    # Fork prong positions (3 vertical lines above center)
    def draw(x, y):
        dx, dy = x - cx, y - cy
        d = math.sqrt(dx * dx + dy * dy)
        if d <= inner_r:
            return (255, 255, 255)   # white center (plate face)
        elif d <= outer_r:
            return (9, 105, 218)     # blue ring (plate rim)
        else:
            return (9, 105, 218)     # blue background
    return draw

os.chdir(os.path.dirname(os.path.abspath(__file__)))
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    data = make_png(size, make_icon_pixel(size))
    with open(name, 'wb') as f:
        f.write(data)
    print('Criado:', name)
print('Pronto.')
