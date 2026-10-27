import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_social_assets():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_dir = os.path.join(project_root, 'src')
    dist_dir = project_root

    # 1. Generate og-image.png (1200 x 630) using 2x supersampling (2400 x 1260)
    scale = 2
    w, h = 1200 * scale, 630 * scale
    img = Image.new('RGBA', (w, h), (8, 9, 13, 255)) # #08090D
    draw = ImageDraw.Draw(img)

    # Subtle background technical grid
    grid_spacing = 40 * scale
    for x in range(0, w, grid_spacing):
        for y in range(0, h, grid_spacing):
            draw.point((x, y), fill=(255, 255, 255, 18))

    # Center card container
    card_w, card_h = 240 * scale, 240 * scale
    cx, cy = w // 2, (h // 2) - (40 * scale)
    x0, y0 = cx - (card_w // 2), cy - (card_h // 2)
    x1, y1 = cx + (card_w // 2), cy + (card_h // 2)

    # Glow effect behind the Cero icon
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        [cx - 180 * scale, cy - 180 * scale, cx + 180 * scale, cy + 180 * scale],
        fill=(6, 182, 212, 45) # cyan-500 with alpha
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=60 * scale))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # Dark rounded box for icon (#10131C)
    radius = 36 * scale
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=(16, 19, 28, 255), outline=(255, 255, 255, 30), width=3 * scale)
    # Inner border glow
    draw.rounded_rectangle([x0 + 2 * scale, y0 + 2 * scale, x1 - 2 * scale, y1 - 2 * scale], radius=radius - 2 * scale, outline=(6, 182, 212, 100), width=2 * scale)

    # Slashed Zero '0' - Perfectly centered inside the box
    # Zero dimensions: width ~ 90*scale, height ~ 130*scale, corner radius ~ 30*scale
    zw = 84 * scale
    zh = 126 * scale
    zx0 = cx - (zw // 2)
    zy0 = cy - (zh // 2)
    zx1 = cx + (zw // 2)
    zy1 = cy + (zh // 2)
    zero_radius = 28 * scale
    line_width = int(14 * scale)

    draw.rounded_rectangle([zx0, zy0, zx1, zy1], radius=zero_radius, outline=(34, 211, 238, 255), width=line_width)

    # Slashed line inside zero
    # from bottom-left to top-right
    slash_x0 = cx - int(24 * scale)
    slash_y0 = cy + int(42 * scale)
    slash_x1 = cx + int(24 * scale)
    slash_y1 = cy - int(42 * scale)
    draw.line([slash_x0, slash_y0, slash_x1, slash_y1], fill=(34, 211, 238, 255), width=int(12 * scale))

    # Telemetry dot on top right of box
    dot_cx = x1 - (4 * scale)
    dot_cy = y0 + (4 * scale)
    dot_r = 16 * scale
    draw.ellipse([dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r], fill=(6, 182, 212, 255))
    draw.ellipse([dot_cx - (dot_r // 2), dot_cy - (dot_r // 2), dot_cx + (dot_r // 2), dot_cy + (dot_r // 2)], fill=(224, 242, 254, 255))

    # Text: Soporte Cero
    # Try finding Inter, Roboto, DejaVuSans, or Arial
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    mono_font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
    if not os.path.exists(font_path):
        font_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
    if not os.path.exists(mono_font_path):
        mono_font_path = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"

    try:
        title_font = ImageFont.truetype(font_path, 48 * scale)
        sub_font = ImageFont.truetype(mono_font_path, 18 * scale)
    except:
        title_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()

    # Title text: "Soporte Cero"
    text_y = cy + (card_h // 2) + (45 * scale)
    
    # Measure text
    text_es = "Soporte Cero"
    t_box = draw.textbbox((0, 0), text_es, font=title_font)
    tw = t_box[2] - t_box[0]
    draw.text((cx - (tw // 2), text_y), "Soporte ", fill=(241, 245, 249, 255), font=title_font)
    
    # Calculate offset for "Cero" in cyan
    soporte_box = draw.textbbox((0, 0), "Soporte ", font=title_font)
    soporte_w = soporte_box[2] - soporte_box[0]
    draw.text((cx - (tw // 2) + soporte_w, text_y), "Cero", fill=(34, 211, 238, 255), font=title_font)

    # Subtitle: "SYS // BASE DE CONOCIMIENTO TÉCNICO"
    sub_text = "SYS // BASE DE CONOCIMIENTO TÉCNICO"
    s_box = draw.textbbox((0, 0), sub_text, font=sub_font)
    sw = s_box[2] - s_box[0]
    draw.text((cx - (sw // 2), text_y + (55 * scale)), sub_text, fill=(148, 163, 184, 255), font=sub_font)

    # Downsample to 1200x630 using Lanczos
    og_image = img.resize((1200, 630), Image.Resampling.LANCZOS)
    
    og_path_dist = os.path.join(dist_dir, 'og-image.png')
    og_path_src = os.path.join(src_dir, 'og-image.png')
    og_image.save(og_path_dist, 'PNG', optimize=True)
    og_image.save(og_path_src, 'PNG', optimize=True)
    print(f"Generated {og_path_dist}")

    # 2. Generate square apple-touch-icon.png (180x180) and favicon.png (512x512)
    def generate_square_icon(size, filename):
        s_scale = 4
        dim = size * s_scale
        s_img = Image.new('RGBA', (dim, dim), (16, 19, 28, 255)) # #10131C
        s_draw = ImageDraw.Draw(s_img)

        # Border
        s_radius = int(dim * 0.22)
        s_draw.rounded_rectangle(
            [int(4 * s_scale), int(4 * s_scale), dim - int(4 * s_scale), dim - int(4 * s_scale)],
            radius=s_radius,
            fill=(16, 19, 28, 255),
            outline=(6, 182, 212, 100),
            width=int(4 * s_scale)
        )

        # Centered Slashed Zero
        c = dim // 2
        z_w = int(dim * 0.42)
        z_h = int(dim * 0.62)
        z_r = int(dim * 0.14)
        z_thick = int(dim * 0.075)

        s_draw.rounded_rectangle(
            [c - (z_w // 2), c - (z_h // 2), c + (z_w // 2), c + (z_h // 2)],
            radius=z_r,
            outline=(34, 211, 238, 255),
            width=z_thick
        )

        # Slash
        sl_w = int(z_w * 0.55)
        sl_h = int(z_h * 0.55)
        s_draw.line(
            [c - (sl_w // 2), c + (sl_h // 2), c + (sl_w // 2), c - (sl_h // 2)],
            fill=(34, 211, 238, 255),
            width=int(z_thick * 0.85)
        )

        # Telemetry dot on top right
        td_cx = dim - int(dim * 0.18)
        td_cy = int(dim * 0.18)
        td_r = int(dim * 0.08)
        s_draw.ellipse([td_cx - td_r, td_cy - td_r, td_cx + td_r, td_cy + td_r], fill=(6, 182, 212, 255))
        s_draw.ellipse([td_cx - (td_r // 2), td_cy - (td_r // 2), td_cx + (td_r // 2), td_cy + (td_r // 2)], fill=(224, 242, 254, 255))

        out = s_img.resize((size, size), Image.Resampling.LANCZOS)
        out.save(os.path.join(dist_dir, filename), 'PNG', optimize=True)
        out.save(os.path.join(src_dir, filename), 'PNG', optimize=True)
        print(f"Generated {filename} ({size}x{size})")

    generate_square_icon(180, 'apple-touch-icon.png')
    generate_square_icon(512, 'favicon.png')

if __name__ == '__main__':
    create_social_assets()
