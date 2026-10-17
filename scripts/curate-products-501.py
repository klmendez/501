"""Borrador visual del lote PRODUCTOS recibido el 10 de octubre de 2026.

Las agrupaciones y marcas son sugerencias para revisar, no datos publicados.
"""

import json
from pathlib import Path


ROOT = Path(r"D:\W\501\PRODUCTOS\_revision_501")
ROWS = """
1,7|Jeans|Jean negro de pierna recta|Por confirmar|Negro|Dos fotos muy parecidas; confirmar si son el mismo jean
2|Jeans|Jean azul oscuro recto|Por confirmar|Azul oscuro|
3,5,8|Jeans|Jean azul de lavado medio|Por confirmar|Azul|Confirmar si las tres fotos corresponden a la misma referencia
4|Chaquetas|Chaqueta roja y negra con capucha|Superdry|Rojo, negro|Marca según texto repetido visible en la chaqueta
6|Jeans|Jean azul de lavado medio|Por confirmar|Azul|Comparar con fotos 3, 5 y 8
9|Conjuntos|Conjunto de camisa y bermuda blanco|Por confirmar|Blanco|Color alternativo de fotos 10 y 11
10|Conjuntos|Conjunto de camisa y bermuda beige|Por confirmar|Beige|Color alternativo de fotos 9 y 11
11|Conjuntos|Conjunto de camisa y bermuda gris|Por confirmar|Gris|Color alternativo de fotos 9 y 10
12|Camisas|Polo verde con ribetes claros|Por confirmar|Verde|Revisar logo de pecho
13|Conjuntos|Conjunto deportivo rojo con detalles blancos|Por confirmar|Rojo, blanco|
14,18|Camisas|Polo gris de manga corta|Por confirmar|Gris|Dos vistas similares
15|Camisas|Polo blanco de manga corta|Por confirmar|Blanco|Confirmar logo de pecho
16|Bermudas|Bermuda negra con salpicaduras decorativas|Dsquared2|Negro|Marca según etiquetas visibles; confirmar largo y si la foto 20 muestra la parte trasera
17,19|Jeans|Surtido de jeans azules con desgaste|Por confirmar|Azul|La foto muestra varios jeans; separar referencias antes de publicar
20|Bermudas|Bermuda negra vista posterior|Por confirmar|Negro|Falta identificar la foto frontal correspondiente
21|Bermudas|Bermuda oscura vista posterior|Por confirmar|Gris oscuro|Falta identificar la foto frontal correspondiente
22|Bermudas|Bermuda negra con desgaste|Por confirmar|Negro|
23,24|Bermudas|Bermuda gris lisa|Por confirmar|Gris|Frente y espalda probables; confirmar
25|Bermudas|Bermuda gris con lavado desgastado|Por confirmar|Gris|
26,27|Bermudas|Bermuda de jean azul claro|Por confirmar|Azul claro|Frente y espalda probables; confirmar
28|Jeans|Jean azul oscuro recto|Por confirmar|Azul oscuro|
29|Chaquetas|Chaqueta acolchada azul rey con capucha|Columbia|Azul rey|Marca según logo visible; comparar con foto 51
30|Jeans|Jean negro de lavado oscuro|Por confirmar|Negro|
31|Jeans|Jean negro con desgaste en muslos|Por confirmar|Negro|
32|Chaquetas|Chaqueta acolchada verde oliva con capucha|Por confirmar|Verde oliva|
33|Jeans|Jean azul con detalles desgastados|Por confirmar|Azul|Comparar con fotos 35 y 36
34,41,42|Chaquetas|Chaqueta acolchada azul grisáceo con capucha|Por confirmar|Azul grisáceo|Tres tomas del mismo modelo probable
35|Jeans|Jean azul con desgaste frontal|Por confirmar|Azul|Comparar con fotos 33 y 36
36|Jeans|Jean azul con roturas frontales|Por confirmar|Azul|Comparar con fotos 33 y 35
37,40|Jeans|Jean negro con desgaste localizado|Por confirmar|Negro|Confirmar que son dos vistas de la misma prenda
38|Jeans|Jean azul con parches y desgaste|Por confirmar|Azul|
39|Jeans|Jean azul oscuro con desgaste leve|Por confirmar|Azul oscuro|
43|Jeans|Jean azul con detalles desgastados|Por confirmar|Azul|
44|Chaquetas|Chaqueta acolchada blanca con capucha|Por confirmar|Blanco|
45|Chaquetas|Chaqueta acolchada café y negra|The North Face|Café, negro|Marca según logo visible; confirmar referencia y autenticidad
46,47,49|Chaquetas|Chaqueta acolchada verde con capucha|Por confirmar|Verde|Tres tomas muy similares
48|Chaquetas|Detalle interior de chaqueta acolchada|Por confirmar|Negro|Asignar a la chaqueta correspondiente; no publicar como producto separado
50|Chaquetas|Chaqueta acolchada beige con capucha|Por confirmar|Beige|Comparar con foto 53
51|Chaquetas|Chaqueta acolchada azul rey con capucha|Columbia|Azul rey|Marca según logo visible; comparar con foto 29
52|Chaquetas|Chaqueta acolchada azul marino y roja|Por confirmar|Azul marino, rojo|La foto 48 podría ser un detalle de esta prenda
53|Chaquetas|Chaqueta acolchada beige con capucha|Por confirmar|Beige|Comparar con foto 50
54|Chaquetas|Chaqueta acolchada café oscuro con capucha|Por confirmar|Café oscuro|
55|Chaquetas|Detalle interior de chaqueta acolchada beige|Por confirmar|Beige|Asignar a foto 50 o 53; no publicar como producto separado
56,58,60|Buzos|Buzo azul con capucha y estampado frontal|Superdry|Azul|Marca según estampado visible; confirmar que las tres tomas son la misma prenda
57|Chaquetas|Chaqueta azul con mangas claras y capucha|Por confirmar|Azul, blanco|
59|Buzos|Buzo rojo con estampado 64|Superdry|Rojo|Marca según estampado visible
61|Buzos|Buzo verde agua con capucha|Por confirmar|Verde agua|
62,65|Buzos|Buzo azul marino con capucha y cordones blancos|Por confirmar|Azul marino|Dos tomas de la misma prenda probable
63|Buzos|Buzo negro con cremallera y logo frontal|Diesel|Negro|Marca según estampado visible
64|Buzos|Buzo azul marino y gris con capucha|Superdry|Azul marino, gris|Marca según parche visible
66,67,68,69|Buzos|Buzo azul marino con cremallera y detalles naranjas|Superdry|Azul marino, naranja|Cuatro tomas de la misma prenda probable; marca según manga visible
70,72|Buzos|Buzo café con capucha y estampado frontal|Superdry|Café|Dos tomas similares; marca según estampado visible
71|Buzos|Buzo rojo de cuello alto con media cremallera|Superdry|Rojo|Marca según estampado visible
73|Buzos|Buzo negro con capucha y estampado rojo|Superdry|Negro|Marca según estampado visible
74,76|Buzos|Buzo negro con capucha y estampado Vintage|Superdry|Negro|Una foto de producto sobre fondo blanco; confirmar que es la misma referencia
75|Buzos|Buzo verde con capucha y franjas oscuras|Superdry|Verde, gris|Foto de producto sobre fondo blanco; marca según etiqueta visible
77|Conjuntos|Conjunto negro de camisa y bermuda|Por confirmar|Negro|Confirmar marca en etiqueta
78,79|Buzos|Buzo gris con capucha y letras 1892|Abercrombie|Gris|Dos tomas casi iguales; marca según estampado visible
80,86|Buzos|Buzo gris con capucha y logo frontal|Diesel|Gris|Dos tomas similares; marca según estampado visible
81|Buzos|Buzo azul marino con capucha y logo frontal|Superdry|Azul marino|Marca según estampado visible
82|Chaquetas|Chaqueta negra estilo bomber|Por confirmar|Negro|
83|Buzos|Buzo azul marino con capucha y estampado Athletic|Superdry|Azul marino|Marca según estampado visible
84|Buzos|Buzo blanco de cuello redondo con logo|Diesel|Blanco|Marca según estampado visible
85|Buzos|Buzo blanco de cuello redondo con logo azul|Superdry|Blanco|Marca según estampado visible
87|Camisetas|Camiseta blanca con estampado de calavera|Philipp Plein|Blanco|Marca según estampado visible
88|Camisetas|Camiseta gris con gráfico circular|Por confirmar|Gris|Confirmar marca del estampado
89|Camisetas|Camiseta gris de manga corta|Por confirmar|Gris|Confirmar logo pequeño del pecho
90|Camisetas|Camiseta blanca con gráfico rojo|Diesel|Blanco, rojo|Marca según estampado visible
91|Camisetas|Camiseta blanca con logo rojo|Diesel|Blanco, rojo|Marca según estampado visible; confirmar si es variante de foto 90
92,93|Buzos|Buzo azul marino y blanco con cremallera|Superdry|Azul marino, blanco|Dos tomas casi iguales; marca según estampado visible
94|Buzos|Buzo verde lima con capucha|Superdry|Verde lima|Marca según estampado visible
95|Buzos|Buzo amarillo con capucha y logo blanco|Superdry|Amarillo|Marca según estampado visible
96|Buzos|Buzo café con capucha y logo blanco|Superdry|Café|Marca según estampado visible
97|Buzos|Buzo camuflado gris con capucha|Por confirmar|Gris, negro|Confirmar marca
98|Buzos|Buzo azul marino con capucha y texto rosa|Superdry|Azul marino|Marca según estampado visible
99|Buzos|Buzo rojo y blanco con logo frontal|Diesel|Rojo, blanco|Marca según estampado visible
100|Buzos|Buzo azul marino con capucha y logo naranja|Superdry|Azul marino|Marca según estampado visible
"""


def main() -> None:
    photos = json.loads((ROOT / "inventario.json").read_text(encoding="utf-8"))
    total = {photo["id"] for photo in photos}
    seen = set()
    products = []
    for number, line in enumerate(ROWS.strip().splitlines(), 1):
        photo_ids, category, name, brand, colors, notes = line.split("|")
        ids = [int(value) for value in photo_ids.split(",")]
        if any(i in seen for i in ids):
            raise ValueError(f"Foto repetida en ficha {number}: {ids}")
        seen.update(ids)
        products.append({
            "reference": f"REV-{number:03d}",
            "photoIds": ids,
            "name": name,
            "brand": brand,
            "category": category,
            "colors": colors,
            "description": f"{name}. Color visible: {colors.lower()}.",
            "notes": notes or "Confirmar referencia, tallas y marca antes de publicar.",
        })
    if seen != total:
        raise ValueError(f"Fotos sin ficha: {sorted(total - seen)}; fotos inexistentes: {sorted(seen - total)}")
    (ROOT / "fichas_borrador.json").write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(products)} fichas preliminares para {len(seen)} fotos")


if __name__ == "__main__":
    main()
