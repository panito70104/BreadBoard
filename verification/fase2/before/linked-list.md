# Listas enlazadas: la cadena de nodos

idioma: es · 6 escenas · 154s

## 1. Qué es un nodo (24s)

> Imagina una caja. Dentro hay dos cosas: un dato, y un papelito con la dirección de la siguiente caja. Esa caja es un nodo. Si encadenas muchas cajas así, tienes una lista enlazada. La última caja no tiene papelito: ahí se acaba la cadena.

layout: `visual-left-bullets-right`

- `title` "Qué es un nodo"  ← on: "Esa caja es un nodo"
- `emphasis` underline -> title  ← on: "Esa caja es un nodo"
- `sketch` [Box:"dato" MapPin:"dirección"] rel=plus pie="un nodo"  ← on: "Imagina una caja"
- `sketch` [Box Box Box:"fin"] rel=arrow  ← on: "Si encadenas muchas cajas"
- `bullet` "El último guarda null"  ← on: "La última caja no tiene papelito"
- `emphasis` box -> visual  ← on: "ahí se acaba la cadena"

## 2. Array contra lista (24s)

> Un array es como una fila de casillas pegadas en la memoria. Si sabes dónde empieza, calculas cualquier casilla de un salto. Los nodos de una lista, en cambio, están tirados por todo el mapa: uno aquí, el siguiente muy lejos. Lo único que los une son las flechas.

layout: `two-column-compare`

- `title` "Array contra lista"  ← on: "Un array es como una fila"
- `sketch` [Square Square Square] rel=none pie="array: todo seguido"  ← on: "casillas pegadas en la memoria"
- `bullet` "Salto directo a la casilla"  ← on: "calculas cualquier casilla de un salto"
- `sketch` [Box:"1000" Box:"7400" Box:"2100"] rel=arrow pie="lista: repartida"  ← on: "están tirados por todo el mapa"
- `emphasis` circle -> right  ← on: "Lo único que los une son las flechas"

## 3. Buscar cuesta caro (24s)

> Para llegar al quinto nodo no puedes saltar. Empiezas por la cabeza y sigues las flechas, una por una, como quien camina por un sendero. Si hay cien nodos, en el peor caso das cien pasos. Eso es lo que llamamos o de ene. El array, en cambio, llega de un salto.

layout: `visual-left-bullets-right`

- `title` "Buscar cuesta caro"  ← on: "Para llegar al quinto nodo"
- `sketch` [Flag:"cabeza" Footprints Footprints Target:"buscado"] rel=arrow pie="paso a paso"  ← on: "Empiezas por la cabeza y sigues las flechas"
- `bullet` "Buscar en la lista: O(n)"  ← on: "das cien pasos"
- `icon` Zap  ← on: "El array, en cambio, llega de un salto"

## 4. Insertar es barato (29s)

> Aquí gana la lista. Para meter algo en medio de un array hay que empujar todo lo que viene detrás para hacer sitio. En la lista no se mueve nadie: el nodo de antes deja de apuntar a su vecino y apunta al nuevo, y el nuevo apunta al vecino. Dos flechas cambiadas y ya está. Borrar es igual de fácil.

layout: `two-column-compare`

- `title` "Insertar es barato"  ← on: "Aquí gana la lista"
- `sketch` [Square Package:"nuevo" Truck:"empujar"] rel=plus pie="array: mueve todo"  ← on: "hay que empujar todo lo que viene detrás"
- `sketch` [Box Package:"nuevo" Box] rel=arrow pie="solo dos flechas"  ← on: "En la lista no se mueve nadie"
- `bullet` "Insertar y borrar: O(1)"  ← on: "Dos flechas cambiadas y ya está"
- `emphasis` box -> right  ← on: "Borrar es igual de fácil"

## 5. Lo que se paga (24s)

> Nada es gratis. Cada nodo gasta memoria de más solo para guardar la dirección. Con datos de cuatro bytes y direcciones de ocho, dos tercios de la memoria se van en flechas. Y como los nodos están dispersos, el procesador falla la caché: se trae lo de al lado y casi nunca le sirve.

layout: `center-diagram-labels`

- `title` "Lo que se paga"  ← on: "Nada es gratis"
- `diagram` bars [dato 4 | puntero 8]  ← on: "solo para guardar la dirección"
- `bullet` "Dos tercios en direcciones"  ← on: "dos tercios de la memoria se van en flechas"
- `sketch` [Cpu:"caché" Box:"lejos"] rel=arrow pie="falla casi siempre"  ← on: "el procesador falla la caché"

## 6. Variantes y elección (29s)

> Dos variantes. La doblemente enlazada añade una flecha hacia atrás, así se camina en los dos sentidos. La circular hace que el último apunte al primero, como el turno de los jugadores. Y para elegir: array si vas a leer mucho por posición, lista si vas a insertar y borrar todo el rato.

layout: `visual-left-bullets-right`

- `title` "Variantes y elección"  ← on: "Dos variantes"
- `sketch` [Box ArrowLeftRight:"doble" Box] rel=none pie="doblemente enlazada"  ← on: "añade una flecha hacia atrás"
- `sketch` [Users:"turnos" RefreshCw:"circular"] rel=arrow pie="el último vuelve al primero"  ← on: "como el turno de los jugadores"
- `bullet` "Array: leer por posición"  ← on: "array si vas a leer mucho por posición"
- `bullet` "Lista: insertar y borrar"  ← on: "lista si vas a insertar y borrar todo el rato"
- `emphasis` box -> list  ← on: "lista si vas a insertar y borrar todo el rato"

## Avisos del validador

- `sketch-repaired` El sketch se quedó con un solo dibujo; se convirtió en un icono suelto.
- `text-heavy` El primer guion traía 9 dibujos para 17 líneas de texto; se pidió de nuevo y se usó el que más dibuja (12).
