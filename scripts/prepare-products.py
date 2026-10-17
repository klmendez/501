"""Crea una revisión local de una carpeta de fotos sin modificar los originales.

Uso: python scripts/prepare-products.py D:\\W\\501\\PRODUCTOS
Requiere Pillow: python -m pip install Pillow
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def inventory(folder: Path, previous: list[dict]) -> list[dict]:
    photos = []
    known_ids = {photo["file"]: photo["id"] for photo in previous}
    next_id = max((photo["id"] for photo in previous), default=0) + 1
    for path in sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONS):
        number = known_ids.get(path.name)
        if number is None:
            number = next_id
            next_id += 1
        with Image.open(path) as image:
            width, height = image.size
        photos.append({
            "id": number,
            "file": path.name,
            "width": width,
            "height": height,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        })
    return sorted(photos, key=lambda photo: photo["id"])


def contact_sheets(folder: Path, output: Path, photos: list[dict]) -> None:
    try:
        font = ImageFont.truetype("arial.ttf", 19)
    except OSError:
        font = ImageFont.load_default()
    for start in range(0, len(photos), 20):
        canvas = Image.new("RGB", (1200, 1425), "#f5f5f5")
        draw = ImageDraw.Draw(canvas)
        for index, photo in enumerate(photos[start:start + 20]):
            with Image.open(folder / photo["file"]) as original:
                thumbnail = ImageOps.contain(ImageOps.exif_transpose(original).convert("RGB"), (282, 245))
            col, row = index % 4, index // 4
            x = col * 300 + (300 - thumbnail.width) // 2
            y = row * 285 + 5 + (245 - thumbnail.height) // 2
            canvas.paste(thumbnail, (x, y))
            draw.text((col * 300 + 10, row * 285 + 252), f'{photo["id"]:03d}  {photo["file"][-18:]}', font=font, fill="#111111")
        canvas.save(output / f"contacto_{start // 20 + 1:02d}.jpg", quality=90)


def review_page(photos: list[dict], draft: list[dict]) -> str:
    payload = json.dumps({"photos": photos, "products": draft}, ensure_ascii=False).replace("<", "\\u003c")
    return """<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisión de productos · 501</title><style>
:root{font-family:Inter,Arial,sans-serif;color:#f4f1ed;background:#141619}*{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;z-index:2;background:#202328;padding:18px 3%;display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid #41464c}h1{font-size:22px;margin:0}header p{font-size:13px;color:#aeb4bd;margin:5px 0 0}button{background:#d5f469;color:#182012;border:0;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:700}main{padding:24px 3%;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}.card{background:#22262b;border:1px solid #3b4047;border-radius:14px;overflow:hidden}.photos{display:flex;gap:6px;overflow-x:auto;padding:10px;background:#111315;min-height:210px}.photo{min-width:140px;max-width:170px;position:relative}.photo img{width:100%;height:180px;object-fit:contain;background:#1b1e21}.photo small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#c7c9ce}.fields{padding:16px;display:grid;gap:10px}.fields label{display:grid;gap:4px;color:#aeb4bd;font-size:12px}.fields input,.fields select,.fields textarea{width:100%;background:#15181b;border:1px solid #474d54;border-radius:7px;color:white;padding:8px;font:inherit}.fields textarea{min-height:70px}.tag{font-size:12px;color:#d5f469}.hint{color:#c7a572;font-size:12px}.empty{padding:30px}
</style><header><div><h1>501 · Revisión de productos</h1><p id="summary"></p></div><button id="download">Descargar fichas revisadas</button></header><main id="cards"></main>
<script>const initial=""" + payload + """;const key='501-review-'+initial.photos.map(p=>p.sha256.slice(0,8)).join('');let products;try{products=JSON.parse(localStorage.getItem(key))||initial.products}catch{products=initial.products}const byId=new Map(initial.photos.map(p=>[p.id,p]));const fields=['name','brand','category','colors','description','notes'];function escapeText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function save(){try{localStorage.setItem(key,JSON.stringify(products))}catch{}}function render(){document.querySelector('#summary').textContent=`${products.length} fichas sugeridas · ${initial.photos.length} fotos · guardado local en este navegador`;document.querySelector('#cards').innerHTML=products.map((p,i)=>`<article class="card"><div class="photos">${p.photoIds.map(id=>{let x=byId.get(id);return x?`<div class="photo"><img loading="lazy" src="../${encodeURIComponent(x.file)}" alt="Foto ${id}"><small>${id} · ${escapeText(x.file)}</small><select data-move="${id}" aria-label="Mover foto ${id}"><option value="">Mover a…</option>${products.map((o,j)=>j!==i?`<option value="${j}">${escapeText(o.reference)}</option>`:'').join('')}</select><button type="button" data-split="${id}">Separar foto</button></div>`:''}).join('')}</div><div class="fields"><b>${escapeText(p.reference)} <span class="tag">${p.photoIds.length} foto(s)</span></b>${fields.map(f=>`<label>${({name:'Nombre',brand:'Marca',category:'Categoría',colors:'Colores',description:'Descripción',notes:'Revisar'})[f]}${f==='description'||f==='notes'?`<textarea data-index="${i}" data-field="${f}">${escapeText(p[f])}</textarea>`:`<input data-index="${i}" data-field="${f}" value="${escapeText(p[f])}">`}</label>`).join('')}<span class="hint">Referencia provisional. Confirma marca, tallas y agrupación antes de publicar.</span></div></article>`).join('')||'<p class="empty">No hay fotos.</p>'}document.addEventListener('input',e=>{let el=e.target;if(el.dataset.field){products[Number(el.dataset.index)][el.dataset.field]=el.value;save()}});document.addEventListener('change',e=>{let el=e.target;if(el.dataset.move){let id=Number(el.dataset.move),to=Number(el.value),from=products.findIndex(p=>p.photoIds.includes(id));if(el.value!==''&&from!==to){products[from].photoIds=products[from].photoIds.filter(x=>x!==id);products[to].photoIds.push(id);products=products.filter(p=>p.photoIds.length);save();render()}}});document.addEventListener('click',e=>{let el=e.target;if(el.dataset.split){let id=Number(el.dataset.split),from=products.findIndex(p=>p.photoIds.includes(id));if(from<0||products[from].photoIds.length<2)return;let original=products[from];original.photoIds=original.photoIds.filter(x=>x!==id);products.push({...original,reference:'REV-N'+Date.now().toString(36),photoIds:[id],notes:'Foto separada; revisar datos.'});save();render()}});document.querySelector('#download').onclick=()=>{let blob=new Blob([JSON.stringify({version:1,source:'revision-local',products},null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fichas-revisadas-501.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};render();</script></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    args = parser.parse_args()
    folder = args.folder.resolve()
    if not folder.is_dir():
        parser.error(f"No existe la carpeta: {folder}")
    output = folder / "_revision_501"
    output.mkdir(exist_ok=True)
    inventory_path = output / "inventario.json"
    previous = json.loads(inventory_path.read_text(encoding="utf-8")) if inventory_path.exists() else []
    photos = inventory(folder, previous)
    if not photos:
        parser.error("No se encontraron fotos JPG, PNG o WebP.")
    contact_sheets(folder, output, photos)
    inventory_path.write_text(json.dumps(photos, ensure_ascii=False, indent=2), encoding="utf-8")
    draft_path = output / "fichas_borrador.json"
    if draft_path.exists():
        draft = json.loads(draft_path.read_text(encoding="utf-8"))
        assigned = {photo_id for product in draft for photo_id in product["photoIds"]}
        for photo in photos:
            if photo["id"] not in assigned:
                draft.append({"reference": f"REV-{photo['id']:03d}", "photoIds": [photo["id"]], "name": "", "brand": "Por confirmar", "category": "", "colors": "", "description": "", "notes": "Foto nueva: revisar."})
        draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        draft = [{"reference": f"REV-{p['id']:03d}", "photoIds": [p["id"]], "name": "", "brand": "Por confirmar", "category": "", "colors": "", "description": "", "notes": ""} for p in photos]
        draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "revisar.html").write_text(review_page(photos, draft), encoding="utf-8")
    print(f"{len(photos)} fotos · {len(draft)} fichas · {output / 'revisar.html'}")


if __name__ == "__main__":
    main()


