r"""Análisis local de fotos de productos: recorte, mejora, OCR y similitud.

Conserva las fotos originales. Las sugerencias requieren revisión humana.
Ejemplo:
  D:\W\501\.venv-product-vision\Scripts\python.exe scripts/product-vision.py D:\W\501\PRODUCTOS --limit 12 --ocr
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import quote

import cv2
import numpy as np
from PIL import Image, ImageOps


EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
BRANDS = {
    "Levi's": ["levis", "levi s", "levi"],
    "Diesel": ["diesel"],
    "Superdry": ["superdry", "super dry"],
    "Columbia": ["columbia"],
    "The North Face": ["the north face", "north face"],
    "Abercrombie & Fitch": ["abercrombie", "abercrombie fitch"],
    "Philipp Plein": ["philipp plein", "philipplein"],
    "Dsquared2": ["dsquared2", "dsq2", "dsq"],
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in text if not unicodedata.combining(c))).strip()


def image_hash(image: Image.Image) -> int:
    # Hash perceptual DCT de 64 bits, útil para duplicados y tomas casi iguales.
    gray = cv2.cvtColor(np.asarray(ImageOps.fit(image.convert("RGB"), (256, 256))), cv2.COLOR_RGB2GRAY)
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    low = cv2.dct(small)[:8, :8]
    median = np.median(low[1:, :])
    return int("".join("1" if value > median else "0" for value in low.flat), 2)


def make_embedding(image: Image.Image, model, preprocess) -> list[float]:
    import torch

    with torch.inference_mode():
        vector = model(preprocess(image.convert("RGB")).unsqueeze(0)).flatten().cpu().numpy()
    vector = vector / max(float(np.linalg.norm(vector)), 1e-8)
    return vector.astype(np.float32).tolist()


def load_embedding_model():
    import torch
    from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

    torch.set_num_threads(min(4, os.cpu_count() or 1))
    weights = MobileNet_V3_Small_Weights.DEFAULT
    model = mobilenet_v3_small(weights=weights)
    model.classifier = torch.nn.Identity()
    model.eval()
    return model, weights.transforms()


def masked_crop(image: Image.Image, alpha: Image.Image | None) -> Image.Image:
    rgb = image.convert("RGB")
    if alpha is None:
        return rgb
    array = np.asarray(alpha)
    ys, xs = np.where(array > 32)
    if len(xs) < 100:
        return rgb
    left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    pad = int(max(right - left, bottom - top) * 0.04)
    box = (max(0, left - pad), max(0, top - pad), min(rgb.width, right + pad), min(rgb.height, bottom + pad))
    crop = rgb.crop(box)
    mask = alpha.crop(box)
    white = Image.new("RGB", crop.size, "white")
    white.paste(crop, mask=mask)
    return white


def color_histogram(image: Image.Image, alpha: Image.Image | None) -> list[float]:
    hsv = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2HSV)
    mask = cv2.resize(np.asarray(alpha), (image.width, image.height)) if alpha is not None else None
    hist = cv2.calcHist([hsv], [0, 1], mask, [18, 8], [0, 180, 0, 256]).flatten().astype(np.float32)
    hist /= max(float(hist.sum()), 1e-8)
    return hist.tolist()


def enhance(image: Image.Image) -> Image.Image:
    # CLAHE moderado solo sobre luminosidad; no altera el tono del producto.
    rgb = np.asarray(image.convert("RGB"))
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    light, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8))
    balanced = cv2.addWeighted(light, 0.75, clahe.apply(light), 0.25, 0)
    result = cv2.cvtColor(cv2.merge((balanced, a, b)), cv2.COLOR_LAB2RGB)
    soft = cv2.GaussianBlur(result, (0, 0), 0.7)
    result = cv2.addWeighted(result, 1.10, soft, -0.10, 0)
    return Image.fromarray(result)


def mask_quality(alpha: Image.Image) -> dict:
    values = np.asarray(alpha, dtype=np.uint8)
    occupied = values > 32
    coverage = float(np.mean(occupied))
    border = np.concatenate((occupied[0], occupied[-1], occupied[:, 0], occupied[:, -1]))
    warnings = []
    if coverage < 0.15:
        warnings.append("máscara demasiado pequeña")
    if coverage > 0.84:
        warnings.append("máscara cubre casi toda la imagen")
    if float(np.mean(border)) > 0.12:
        warnings.append("prenda toca el borde")
    return {"coverage": round(coverage, 3), "warnings": warnings}


def brand_votes(lines: list[dict]) -> list[dict]:
    scores: dict[str, float] = {}
    evidence: dict[str, list[str]] = {}
    for line in lines:
        found = normalize(line["text"])
        if len(found) < 3:
            continue
        for brand, aliases in BRANDS.items():
            similarity = max(1.0 if alias in found else SequenceMatcher(None, found, alias).ratio() for alias in aliases)
            if similarity < 0.82:
                continue
            score = float(line["confidence"]) * similarity
            scores[brand] = max(scores.get(brand, 0), score)
            evidence.setdefault(brand, []).append(line["text"])
    return [{"brand": brand, "score": round(score, 3), "evidence": evidence[brand][:3]} for brand, score in sorted(scores.items(), key=lambda item: item[1], reverse=True)]


def ocr_image(reader, image: Image.Image) -> list[dict]:
    # La mayoría de logos están en el torso o en la cintura; recortar reduce
    # mucho el tiempo de CPU y evita leer letreros del fondo.
    rgb = np.asarray(image.convert("RGB"))
    region = rgb[: int(rgb.shape[0] * 0.78)]
    results = reader.readtext(region, detail=1, paragraph=False, canvas_size=1600)
    lines = [{"text": text, "confidence": round(float(confidence), 3)} for _, text, confidence in results if confidence >= 0.18]
    if not brand_votes(lines):
        # Segundo intento solo en la zona superior, ampliada para etiquetas pequeñas.
        label = rgb[: int(rgb.shape[0] * 0.38), int(rgb.shape[1] * 0.12): int(rgb.shape[1] * 0.88)]
        label = cv2.resize(label, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
        extra = reader.readtext(label, detail=1, paragraph=False, canvas_size=1600)
        lines.extend({"text": text, "confidence": round(float(confidence), 3)} for _, text, confidence in extra if confidence >= 0.18)
    return lines


def google_vision_evidence(path: Path, client) -> dict:
    from google.cloud import vision

    response = client.annotate_image(request={
        "image": vision.Image(content=path.read_bytes()),
        "features": [
            {"type_": vision.Feature.Type.LOGO_DETECTION},
            {"type_": vision.Feature.Type.WEB_DETECTION},
        ],
    })
    if response.error.message:
        raise RuntimeError(response.error.message)
    web = response.web_detection
    return {
        "logos": [{"name": logo.description, "score": round(float(logo.score), 3)} for logo in response.logo_annotations],
        "matching_pages": [{"url": page.url, "title": page.page_title} for page in web.pages_with_matching_images[:8]],
        "best_guess": [label.label for label in web.best_guess_labels[:5]],
    }


def pair_score(a: dict, b: dict) -> dict:
    va = np.asarray(a["embedding"], dtype=np.float32)
    vb = np.asarray(b["embedding"], dtype=np.float32)
    semantic = max(0.0, min(1.0, float(np.dot(va, vb))))
    color_a = np.asarray(a["color_histogram"], dtype=np.float32)
    color_b = np.asarray(b["color_histogram"], dtype=np.float32)
    color = max(0.0, min(1.0, float(np.sum(np.sqrt(color_a * color_b)))))
    hash_similarity = 1.0 - (int(a["phash"], 16) ^ int(b["phash"], 16)).bit_count() / 64
    shape = min(a["aspect_ratio"], b["aspect_ratio"]) / max(a["aspect_ratio"], b["aspect_ratio"])
    same_text = bool(set(a.get("ocr_tokens", [])) & set(b.get("ocr_tokens", [])))
    score = 0.53 * semantic + 0.24 * color + 0.16 * hash_similarity + 0.05 * shape + 0.02 * float(same_text)
    # Marcas distintas en texto legible bloquean la unión automática.
    brand_a = a.get("brand_candidates", [])
    brand_b = b.get("brand_candidates", [])
    conflict = bool(brand_a and brand_b and brand_a[0]["score"] >= 0.75 and brand_b[0]["score"] >= 0.75 and brand_a[0]["brand"] != brand_b[0]["brand"])
    category_conflict = bool(a.get("category") and b.get("category") and a["category"] != b["category"])
    return {"score": round(score, 4), "semantic": round(semantic, 4), "color": round(color, 4), "hash": round(hash_similarity, 4), "shape": round(shape, 4), "brand_conflict": conflict, "category_conflict": category_conflict}


def suggest_groups(items: list[dict], threshold: float) -> tuple[list[list[int]], list[dict]]:
    scores: dict[tuple[int, int], dict] = {}
    pairs = []
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            metrics = pair_score(items[i], items[j])
            scores[(i, j)] = metrics
            if metrics["score"] >= threshold and not metrics["brand_conflict"] and not metrics["category_conflict"]:
                pairs.append((metrics["score"], i, j))
    groups = [[i] for i in range(len(items))]
    for _, i, j in sorted(pairs, reverse=True):
        group_i = next(group for group in groups if i in group)
        group_j = next(group for group in groups if j in group)
        if group_i is group_j:
            continue
        # Enlace completo: evita que una cadena de fotos parecidas mezcle prendas diferentes.
        if all(scores[tuple(sorted((x, y)))]["score"] >= threshold and not scores[tuple(sorted((x, y)))]["brand_conflict"] and not scores[tuple(sorted((x, y)))]["category_conflict"] for x in group_i for y in group_j):
            group_i.extend(group_j)
            groups.remove(group_j)
    suggestions = [{"ids": [items[i]["id"] for i in group], "minimum_pair_score": round(min((scores[tuple(sorted((x, y)))]["score"] for x in group for y in group if x < y), default=1), 4)} for group in groups]
    ranked = [{"photos": [items[i]["id"], items[j]["id"]], **scores[(i, j)]} for i in range(len(items)) for j in range(i + 1, len(items))]
    ranked.sort(key=lambda pair: pair["score"], reverse=True)
    return suggestions, ranked[: min(200, len(ranked))]


def comparison_page(report: dict) -> str:
    cards = []
    for photo in report["photos"]:
        title = html.escape(photo["file"])
        warnings = ", ".join(photo["mask"]["warnings"]) or "sin alerta automática"
        brand = ", ".join(f'{item["brand"]} ({item["score"]:.0%})' for item in photo["brand_candidates"][:3]) or "sin lectura confiable"
        links = "".join(f'<a href="{html.escape(page["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{html.escape(page["title"] or page["url"])[:80]}</a>' for page in (photo.get("google_evidence") or {}).get("matching_pages", [])[:3])
        images = [("Original", photo["original"]), ("Mejora", photo["improved"]), ("Fondo blanco", photo["white"]), ("Transparente", photo["cutout"])]
        gallery = "".join(f'<figure><img loading="lazy" src="{quote(path.replace(chr(92), "/"), safe="/.")}" alt="{html.escape(label)} foto {photo["id"]}"><figcaption>{label}</figcaption></figure>' for label, path in images)
        fallback = "Se conserva la versión mejorada con fondo original para catálogo." if photo.get("background_fallback") else "Versión con fondo blanco disponible para revisión."
        cards.append(f'<article id="foto-{photo["id"]}"><h2>Foto {photo["id"]}: {title}</h2><div class="gallery">{gallery}</div><p><b>Categoría del borrador:</b> {html.escape(photo.get("category") or "por confirmar")}</p><p><b>Marca del borrador:</b> {html.escape(photo.get("draft_brand") or "por confirmar")}</p><p><b>Marca sugerida por OCR o Google:</b> {html.escape(brand)}</p><p><b>Lectura OCR:</b> {html.escape(", ".join(x["text"] for x in photo["ocr"][:8]) or "ninguna")}</p><p><b>Máscara:</b> {photo["mask"]["coverage"]:.0%} · {html.escape(warnings)}. {fallback}</p><p><b>Nota de revisión:</b> {html.escape(photo.get("review_notes") or "sin nota")}</p>{links}</article>')
    groups = "".join(f'<li>{" · ".join(f"<a href=\"#foto-{i}\">{i}</a>" for i in group["ids"])} <small>mínimo {group["minimum_pair_score"]:.0%}</small></li>' for group in report["groups"] if len(group["ids"]) > 1)
    return f'''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visión 501 · comparación</title><style>
    :root{{font-family:Arial,sans-serif;background:#111719;color:#f4f7f5}}*{{box-sizing:border-box}}body{{margin:0}}header{{padding:24px 4%;background:#1b2527;position:sticky;top:0;z-index:2}}h1{{margin:0;font-size:24px}}header p{{margin:6px 0 0;color:#c1ceca}}main{{padding:20px 4%}}article{{border:1px solid #465454;background:#1b2527;border-radius:12px;margin:18px 0;padding:18px}}h2{{font-size:16px;overflow-wrap:anywhere}}.gallery{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}}figure{{margin:0;background:#fff;color:#111}}figure:last-child{{background-color:#ddd;background-image:linear-gradient(45deg,#bbb 25%,transparent 25%),linear-gradient(-45deg,#bbb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bbb 75%),linear-gradient(-45deg,transparent 75%,#bbb 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}}img{{width:100%;height:310px;object-fit:contain}}figcaption{{padding:6px;text-align:center;font-size:13px;background:#e9eceb}}a{{color:#d5f469;margin-right:12px}}li{{margin:7px 0}}small{{color:#a7b9b1}}@media(max-width:700px){{.gallery{{grid-template-columns:repeat(2,minmax(0,1fr))}}img{{height:230px}}}}
    </style><header><h1>501 · comparación visual</h1><p>{report["photo_count"]} fotos · {report["group_count"]} grupos sugeridos · corte en {report["threshold"]:.0%}</p></header><main><section><h2>Grupos con varias fotos</h2><ul>{groups or "<li>Ningún grupo superó el umbral.</li>"}</ul><p>Los porcentajes son similitudes internas, no probabilidades de que sean el mismo producto.</p></section>{"".join(cards)}</main></html>'''


def process(folder: Path, output: Path, limit: int | None, selected_ids: set[int] | None, use_ocr: bool, use_google: bool, threshold: float) -> None:
    from rembg import new_session, remove

    photos = sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONS)
    output.mkdir(parents=True, exist_ok=True)
    cutout_dir = output / "sin_fondo"
    enhanced_dir = output / "mejoradas"
    white_dir = output / "fondo_blanco"
    safe_dir = output / "catalogo_seguro"
    for directory in (cutout_dir, enhanced_dir, white_dir, safe_dir):
        directory.mkdir(exist_ok=True)
    inventory_path = folder / "_revision_501" / "inventario.json"
    old_inventory = json.loads(inventory_path.read_text(encoding="utf-8")) if inventory_path.exists() else []
    ids = {item["file"]: item["id"] for item in old_inventory}
    draft_path = folder / "_revision_501" / "fichas_borrador.json"
    draft = json.loads(draft_path.read_text(encoding="utf-8")) if draft_path.exists() else []
    draft_by_id = {photo_id: product for product in draft for photo_id in product["photoIds"]}
    if selected_ids:
        photos = [path for path in photos if ids.get(path.name) in selected_ids]
    if limit:
        photos = photos[:limit]
    if not photos:
        raise ValueError("No hay fotos compatibles en la selección")
    os.environ["U2NET_HOME"] = str(output / "modelos")
    session = new_session("u2net")
    model, preprocess = load_embedding_model()
    reader = None
    if use_ocr:
        import easyocr
        reader = easyocr.Reader(["en"], gpu=False, model_storage_directory=str(output / "modelos" / "ocr"), verbose=False)
    google_client = None
    if use_google:
        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            raise RuntimeError("Falta GOOGLE_APPLICATION_CREDENTIALS con las credenciales de Google Cloud Vision")
        from google.cloud import vision
        google_client = vision.ImageAnnotatorClient()
    results = []
    features_path = output / "features.json"
    previous = json.loads(features_path.read_text(encoding="utf-8")) if features_path.exists() else []
    cached = {item["sha256"]: item for item in previous}
    def persist_features() -> None:
        merged = {**cached, **{item["sha256"]: item for item in results}}
        features_path.write_text(json.dumps(sorted(merged.values(), key=lambda item: item["id"]), ensure_ascii=False), encoding="utf-8")
    start = time.monotonic()
    for number, path in enumerate(photos, 1):
        photo_id = ids.get(path.name, number)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        prior = cached.get(digest)
        if prior and all((output / prior[key]).exists() for key in ("improved", "cutout", "white")):
            prior["original"] = os.path.relpath(path, output).replace("\\", "/")
            prior["category"] = draft_by_id.get(photo_id, {}).get("category", "")
            prior["draft_brand"] = draft_by_id.get(photo_id, {}).get("brand", "")
            prior["review_notes"] = draft_by_id.get(photo_id, {}).get("notes", "")
            with Image.open(output / prior["cutout"]) as segmented:
                prior["mask"] = mask_quality(segmented.getchannel("A"))
            safe_path = safe_dir / Path(prior["white"]).name
            fallback = "máscara demasiado pequeña" in prior["mask"]["warnings"] or "máscara cubre casi toda la imagen" in prior["mask"]["warnings"]
            shutil.copy2(output / (prior["improved"] if fallback else prior["white"]), safe_path)
            prior["catalog_safe"] = str(safe_path.relative_to(output))
            prior["background_fallback"] = fallback
            if use_ocr and not prior.get("ocr_done"):
                with Image.open(path) as source:
                    original = ImageOps.exif_transpose(source).convert("RGB")
                lines = ocr_image(reader, original)
                prior["ocr"] = lines
                prior["ocr_tokens"] = [normalize(line["text"]) for line in lines if len(normalize(line["text"])) >= 4]
                prior["brand_candidates"] = brand_votes(lines)
                prior["ocr_done"] = True
            if use_google and not prior.get("google_done"):
                google = google_vision_evidence(path, google_client)
                prior["google_evidence"] = google
                prior["google_done"] = True
                for logo in google["logos"]:
                    prior["brand_candidates"].append({"brand": logo["name"], "score": logo["score"], "evidence": ["Google Cloud Vision: logo"]})
                prior["brand_candidates"].sort(key=lambda candidate: candidate["score"], reverse=True)
            results.append(prior)
            print(f"[{number}/{len(photos)}] {path.name} | en caché", flush=True)
            persist_features()
            continue
        stem = f"{photo_id:03d}_{digest[:10]}"
        with Image.open(path) as source:
            original = ImageOps.exif_transpose(source).convert("RGB")
        improved = enhance(original)
        improved_path = enhanced_dir / f"{stem}.webp"
        improved.save(improved_path, "WEBP", quality=88, method=5)
        segmented = remove(improved, session=session)
        rgba = segmented.convert("RGBA")
        alpha = rgba.getchannel("A")
        quality = mask_quality(alpha)
        cutout_path = cutout_dir / f"{stem}.png"
        rgba.save(cutout_path, optimize=True)
        white = Image.new("RGB", rgba.size, "white")
        white.paste(rgba, mask=alpha)
        white_path = white_dir / f"{stem}.webp"
        white.save(white_path, "WEBP", quality=88, method=5)
        safe_path = safe_dir / white_path.name
        fallback = "máscara demasiado pequeña" in quality["warnings"] or "máscara cubre casi toda la imagen" in quality["warnings"]
        shutil.copy2(improved_path if fallback else white_path, safe_path)
        crop = masked_crop(improved, alpha)
        lines = ocr_image(reader, original) if reader else []
        candidates = brand_votes(lines)
        google = google_vision_evidence(path, google_client) if google_client else None
        if google:
            for logo in google["logos"]:
                candidates.append({"brand": logo["name"], "score": logo["score"], "evidence": ["Google Cloud Vision: logo"]})
            candidates.sort(key=lambda candidate: candidate["score"], reverse=True)
        result = {
            "id": photo_id, "file": path.name, "sha256": digest,
            "original": os.path.relpath(path, output).replace("\\", "/"),
            "category": draft_by_id.get(photo_id, {}).get("category", ""),
            "draft_brand": draft_by_id.get(photo_id, {}).get("brand", ""),
            "review_notes": draft_by_id.get(photo_id, {}).get("notes", ""),
            "improved": str(improved_path.relative_to(output)),
            "cutout": str(cutout_path.relative_to(output)),
            "white": str(white_path.relative_to(output)),
            "catalog_safe": str(safe_path.relative_to(output)),
            "background_fallback": fallback,
            "mask": quality, "ocr": lines,
            "ocr_done": use_ocr,
            "google_done": use_google,
            "google_evidence": google,
            "ocr_tokens": [normalize(line["text"]) for line in lines if len(normalize(line["text"])) >= 4],
            "brand_candidates": candidates,
            "phash": f"{image_hash(crop):016x}",
            "color_histogram": color_histogram(improved, alpha),
            "aspect_ratio": round(crop.width / crop.height, 4),
            "embedding": make_embedding(crop, model, preprocess),
        }
        results.append(result)
        print(f"[{number}/{len(photos)}] {path.name} | máscara {quality['coverage']:.0%} | marca {candidates[0]['brand'] if candidates else '?'} | {time.monotonic()-start:.0f}s", flush=True)
        persist_features()
    groups, ranked = suggest_groups(results, threshold)
    report = {"version": 1, "model": "u2net + mobilenet_v3_small + weighted similarity", "threshold": threshold,
              "photo_count": len(results), "group_count": len(groups), "groups": groups, "similar_pairs": ranked,
              "photos": [{key: value for key, value in item.items() if key not in {"embedding", "color_histogram"}} for item in results]}
    suffix = "-seleccion" if selected_ids or limit else ""
    report_path = output / f"vision-report{suffix}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / f"comparar{suffix}.html").write_text(comparison_page(report), encoding="utf-8")
    print(f"Informe: {report_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--ids", help="Solo estos IDs del inventario, separados por coma")
    parser.add_argument("--ocr", action="store_true", help="Lee texto y sugiere marcas; tarda más")
    parser.add_argument("--google-vision", action="store_true", help="Consulta logos y coincidencias web con credenciales de Google Cloud")
    parser.add_argument("--threshold", type=float, default=0.90, help="Umbral de agrupación, entre 0 y 1")
    args = parser.parse_args()
    folder = args.folder.resolve()
    if not folder.is_dir():
        parser.error(f"No existe: {folder}")
    output = (args.output or folder / "_vision_501").resolve()
    if not 0 < args.threshold <= 1:
        parser.error("El umbral debe estar entre 0 y 1")
    selected_ids = {int(value) for value in args.ids.split(",")} if args.ids else None
    process(folder, output, args.limit, selected_ids, args.ocr, args.google_vision, args.threshold)


if __name__ == "__main__":
    main()
