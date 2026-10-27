import os
import re

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(project_root, 'src')

old_logo_pattern = re.compile(
    r'<div class="logo-box relative flex h-9 w-9 items-center justify-center rounded-lg bg-\[#10131C\] border border-white/10 group-hover:border-cyan-500/50 transition-colors shadow-inner">\s*'
    r'<svg class="logo-svg w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1\.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\s*'
    r'<!-- Prompt \'>\' -->\s*'
    r'<polyline points="5 8 9 12 5 16"></polyline>\s*'
    r'<!-- Cero Técnico Cortado \'0\' -->\s*'
    r'<rect x="12" y="7" width="7" height="10" rx="2"></rect>\s*'
    r'<line x1="14" y1="14" x2="17" y2="10" stroke-width="1\.5"></line>\s*'
    r'</svg>',
    re.MULTILINE
)

new_logo_snippet = (
    '<div class="logo-box relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#10131C] border border-white/10 group-hover:border-cyan-500/50 transition-colors shadow-inner">\n'
    '          <svg class="logo-svg w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\n'
    '            <!-- Cero Técnico Cortado \'0\' Centrado -->\n'
    '            <rect x="6.5" y="4.5" width="11" height="15" rx="3.5"></rect>\n'
    '            <line x1="8.5" y1="16" x2="15.5" y2="8" stroke-width="1.5"></line>\n'
    '          </svg>'
)

# Process all html files in src and src/en
template_files = [
    os.path.join(src_dir, 'contacto.html'),
    os.path.join(src_dir, 'index-template.html'),
    os.path.join(src_dir, 'nosotros.html'),
    os.path.join(src_dir, 'post-template.html'),
    os.path.join(src_dir, 'servicios.html'),
    os.path.join(src_dir, 'en', 'contacto.html'),
    os.path.join(src_dir, 'en', 'index-template.html'),
    os.path.join(src_dir, 'en', 'nosotros.html'),
    os.path.join(src_dir, 'en', 'post-template.html'),
    os.path.join(src_dir, 'en', 'servicios.html')
]

for file_path in template_files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace logo
    new_content, count = old_logo_pattern.subn(new_logo_snippet, content)
    if count == 0:
        # Fallback more relaxed replacement for the SVG inner
        relaxed_pattern = re.compile(
            r'<svg class="logo-svg w-5 h-5 text-cyan-400"[^>]*>[\s\S]*?<polyline points="5 8 9 12 5 16"></polyline>[\s\S]*?</svg>',
            re.MULTILINE
        )
        relaxed_replacement = (
            '<svg class="logo-svg w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\n'
            '            <!-- Cero Técnico Cortado \'0\' Centrado -->\n'
            '            <rect x="6.5" y="4.5" width="11" height="15" rx="3.5"></rect>\n'
            '            <line x1="8.5" y1="16" x2="15.5" y2="8" stroke-width="1.5"></line>\n'
            '          </svg>'
        )
        new_content, count = relaxed_pattern.subn(relaxed_replacement, content)

    # 2. Update comments
    new_content = new_content.replace('<!-- Isotipo Terminal + Cero Técnico -->', '<!-- Isotipo Cero Técnico -->')

    # 3. Update apple-touch-icon if missing
    if 'rel="apple-touch-icon"' not in new_content:
        new_content = new_content.replace(
            '<link rel="alternate icon" href="/favicon.svg" type="image/svg+xml">',
            '<link rel="alternate icon" href="/favicon.svg" type="image/svg+xml">\n  <link rel="apple-touch-icon" href="/apple-touch-icon.png">'
        )

    # 4. Update og:image and twitter:image to og-image.png (with full OpenGraph image specs)
    old_og_img = '<meta property="og:image" content="https://soportecero.com/favicon.svg">'
    new_og_img = (
        '<meta property="og:image" content="https://soportecero.com/og-image.png">\n'
        '  <meta property="og:image:secure_url" content="https://soportecero.com/og-image.png">\n'
        '  <meta property="og:image:type" content="image/png">\n'
        '  <meta property="og:image:width" content="1200">\n'
        '  <meta property="og:image:height" content="630">\n'
        '  <meta property="og:image:alt" content="SoporteCero - Cero Errores">'
    )
    new_content = new_content.replace(old_og_img, new_og_img)
    new_content = new_content.replace(
        '<meta name="twitter:image" content="https://soportecero.com/favicon.svg">',
        '<meta name="twitter:image" content="https://soportecero.com/og-image.png">'
    )
    new_content = new_content.replace(
        '<meta name="twitter:card" content="summary">',
        '<meta name="twitter:card" content="summary_large_image">'
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {file_path} (Logo replacements: {count})")
