# Oferta, demanda y equilibrio

idioma: es · 5 escenas · 140s

## 1. La ley de la demanda (26s)

> Mira este café. Cuesta dos euros y la ciudad se bebe mil al día. Ahora sube a cuatro euros. Mucha gente pide té, o se lo hace en casa, o simplemente toma menos. Precio arriba, cantidad abajo. Por eso la demanda se dibuja como una curva que baja de izquierda a derecha, y no como un solo número.

layout: `visual-left-bullets-right`

- `title` "La ley de la demanda"  ← on: "Por eso la demanda se dibuja"
- `sketch` [Coffee:"2 euros" Users:"mil al día"] rel=equals  ← on: "Mira este café"
- `sketch` [Coffee:"4 euros" User:"pocos"] rel=equals  ← on: "Ahora sube a cuatro euros"
- `icon` TrendingDown  ← on: "Precio arriba, cantidad abajo"
- `bullet` "Sube el precio, baja la cantidad"  ← on: "una curva que baja de izquierda a derecha"
- `emphasis` box -> list  ← on: "y no como un solo número"

## 2. La ley de la oferta (26s)

> Del otro lado está el vendedor, y con él todo va al revés. Si el café se paga a un euro, casi ninguna cafetería quiere levantar la persiana. Si se paga a cuatro, aparecen cafeterías nuevas, porque ahora sí les compensa. Precio arriba, cantidad producida arriba también. La curva de oferta sube de izquierda a derecha.

layout: `visual-left-bullets-right`

- `title` "La ley de la oferta"  ← on: "Del otro lado está el vendedor"
- `sketch` [Coins:"1 euro" Store:"una"] rel=arrow  ← on: "casi ninguna cafetería quiere levantar la persiana"
- `sketch` [Coins:"4 euros" Store:"muchas"] rel=arrow  ← on: "aparecen cafeterías nuevas"
- `icon` TrendingUp  ← on: "porque ahora sí les compensa"
- `bullet` "Más precio, más ganas de vender"  ← on: "Precio arriba, cantidad producida arriba también"
- `emphasis` box -> list  ← on: "La curva de oferta sube de izquierda a derecha"

## 3. El punto de equilibrio (28s)

> Ahora pon las dos curvas sobre los mismos ejes. El precio en el eje de arriba, la cantidad en el de abajo. La que baja es la demanda, la que sube es la oferta, y en algún sitio se cruzan. Ese cruce es el equilibrio: mil cafés al día a dos euros y medio. Justo los que la gente quiere y justo los que las cafeterías hacen.

layout: `center-diagram-labels`

- `title` "El punto de equilibrio"  ← on: "Ahora pon las dos curvas"
- `diagram` axes [Precio | Cantidad | Demanda | Oferta]  ← on: "El precio en el eje de arriba"
- `emphasis` circle -> center  ← on: "en algún sitio se cruzan"
- `sketch` [Users:"quieren" Store:"hacen"] rel=equals pie="1000 cafés"  ← on: "mil cafés al día a dos euros y medio"
- `bullet` "Precio: 2,50 euros"  ← on: "Justo los que la gente quiere"
- `emphasis` box -> aside  ← on: "y justo los que las cafeterías hacen"

## 4. Excedente y escasez (30s)

> ¿Y si el precio no es ese? A cuatro euros las cafeterías hacen mil quinientos y la gente compra cuatrocientos. Sobra género, se estropea, y acaban bajando el precio. A un euro pasa lo contrario: la gente quiere dos mil y solo hay quinientos. Aparecen colas, y el vendedor entiende que puede subir el precio. En los dos casos, el mercado vuelve solo al cruce.

layout: `two-column-compare`

- `title` "Excedente y escasez"  ← on: "¿Y si el precio no es ese?"
- `sketch` [Warehouse:"1500" User:"400"] rel=vs pie="Sobra"  ← on: "las cafeterías hacen mil quinientos"
- `bullet` "El precio baja"  ← on: "acaban bajando el precio"
- `sketch` [Users:"2000" Coffee:"500"] rel=vs pie="Falta"  ← on: "la gente quiere dos mil y solo hay quinientos"
- `bullet` "El precio sube"  ← on: "Aparecen colas"
- `emphasis` underline -> title  ← on: "el mercado vuelve solo al cruce"

## 5. Cuando la curva se mueve (30s)

> Falta una cosa. Si la gente gana más dinero, compra más café a cualquier precio: la curva de demanda entera se va a la derecha y el cruce sube. Si el grano se encarece, producir cuesta más y la oferta se va a la izquierda: sube el precio y baja la cantidad. Quédate con esto: el cruce es el equilibrio, y todo lo demás lo mueve.

layout: `visual-left-bullets-right`

- `title` "Cuando la curva se mueve"  ← on: "Falta una cosa"
- `sketch` [Wallet:"más renta" ChartLine:"demanda" ArrowRight:"derecha"] rel=arrow pie="Sube precio y cantidad"  ← on: "Si la gente gana más dinero"
- `sketch` [Wheat:"más coste" Factory:"oferta" TrendingDown:"izquierda"] rel=arrow pie="Sube precio, baja cantidad"  ← on: "Si el grano se encarece"
- `icon` Target  ← on: "Quédate con esto"
- `bullet` "El cruce manda"  ← on: "el cruce es el equilibrio"
- `emphasis` box -> list  ← on: "y todo lo demás lo mueve"

## Avisos del validador

- `text-heavy` El primer guion traía 9 dibujos para 15 líneas de texto; se pidió de nuevo y se usó el que más dibuja (13).
