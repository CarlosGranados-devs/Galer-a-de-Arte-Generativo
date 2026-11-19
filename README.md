<div align="center">

<img src="./public/favicon.svg" width="84" height="84" alt="Synapse Studio" />

# SYNAPSE STUDIO

### El azar, domesticado.

https://galeria-de-arte-generativo.vercel.app/

Una galería de arte generativo procedimental donde cada obra nace de un algoritmo,
una paleta y una semilla determinista. Todo se crea, edita y conserva en una base
de datos **SQLite real** que vive dentro de tu navegador.

<br />

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-sql.js-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-654FF0?style=flat-square&logo=webassembly&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## Descripción

**Synapse Studio** es un laboratorio creativo de nivel producción construido con
**Vite + TypeScript vanilla** y una arquitectura **MVC estricta**. El usuario compone
obras visuales mediante cuatro algoritmos matemáticos, cinco paletas curadas y un
control de complejidad; luego las titula, las firma y las publica en una galería
persistente.

La persistencia es local y real: `sql.js` ejecuta SQLite compilado a WebAssembly y
el binario completo de la base de datos se serializa en Base64 dentro de
`localStorage` después de cada escritura. No hay servidor, no hay cuentas y no hay
dependencias de red para que el museo funcione.

---

## Características principales

### Estudio generativo en vivo

- Canvas de alta resolución con render determinista y sobremuestreado para pantallas Retina.
- **4 algoritmos**: Constelación Geométrica, Ondas de Lissajous, Bauhaus Grid y Nebulosa Espiral.
- **5 paletas curadas**: Cyberpunk, Terracota, Nordic, Solaris y Monocromo.
- Slider de complejidad de 10 a 100 con regeneración en tiempo real.
- Semilla de 32 bits generada criptográficamente y botón de aleatorización.
- Acción **Sorpréndeme**: cambia algoritmo, paleta, complejidad, semilla y sugiere un título.
- Título y autor con validación antes de publicar.

### Galería curada (CRUD completo)

- Cuadrícula responsive con cada obra renderizada desde su semilla guardada.
- Búsqueda instantánea por título o autor.
- Filtros tipo *pill* por paleta y por algoritmo, combinables con la búsqueda.
- Contador dinámico de obras y estado de la base de datos en vivo.
- Estado vacío diferenciado para archivo vacío y para filtros sin resultados.
- **Crear** (`INSERT`), **leer** (`SELECT`), **editar** (`UPDATE`) y **eliminar** (`DELETE`)
  con consultas SQL parametrizadas.

### Extras de alto valor

- **Vista inmersiva (lightbox)** con ficha técnica completa: autora/autor, algoritmo,
  paleta, semilla en hexadecimal y decimal, complejidad, fecha y registro SQLite.
- **Exportación PNG a 2000 × 2000 px** mediante `canvas.toDataURL('image/png')`.
- **Inspector SQL** colapsable que muestra en vivo cada sentencia ejecutada, sus
  parámetros, duración, filas afectadas y origen (`migration` / `seed`).
- **Persistencia automática** en `localStorage` con métricas de tamaño y hora de guardado.
- Confirmación de borrado con modal propio, toasts flotantes y micro-interacciones.
- Notas de foco, trampa de foco en modales, cierre con `Escape` y atajo `/` para buscar.

### Identidad visual

- Estética de galería contemporánea en dark mode, inspirada en Linear, Stripe y museos digitales.
- Tipografías **Space Grotesk** (display), **Inter** (UI) y **JetBrains Mono** (datos técnicos).
- Fondos profundos `#09090B`, superficies `#121216`, acento índigo `#6366F1` → violeta `#8B5CF6`.
- Header glassmorphism, gradientes sutiles, grano procedural y bordes de 1 px.
- Diseño 100 % responsive: móvil, tablet y escritorio.

---

## Stack tecnológico

| Capa | Tecnología | Rol |
| --- | --- | --- |
| Bundler | **Vite 7** | Dev server, build de producción y assets |
| Lenguaje | **TypeScript 5.9** | Tipado estricto, sin frameworks de UI |
| Base de datos | **sql.js 1.16** | SQLite compilado a WebAssembly |
| Persistencia | **localStorage** | Binario SQLite serializado en Base64 |
| Render | **Canvas 2D** | Algoritmos generativos deterministas |
| Estilos | **CSS moderno** | Variables, Grid, Flexbox, glassmorphism |
| Tipografías | **Google Fonts** | Space Grotesk, Inter y JetBrains Mono |
| Deploy | **Vercel** | Hosting estático con el `.wasm` local |

Sin frameworks pesados, sin backend y sin base de datos remota.

---

## Arquitectura MVC

```text
laboratorio03/
├── index.html                  # Shell semántico, modales, metadatos y fuentes
├── package.json                # Dependencias y scripts (sync wasm, dev, build)
├── tsconfig.json               # TypeScript estricto
├── vite.config.ts              # Configuración del bundler
├── README.md
├── .gitignore
├── scripts/
│   └── copy-wasm.mjs           # Copia sql-wasm.wasm a public/ tras instalar/compilar
├── public/
│   ├── favicon.svg
│   └── sql-wasm.wasm           # Copia local del binario de SQLite
└── src/
    ├── main.ts                 # Entry point e inicialización asíncrona de SQLite
    ├── db/
    │   └── database.ts         # Singleton sql.js, esquema, seed, log SQL y persistencia
    ├── models/
    │   └── ArtworkModel.ts     # Tipos, catálogos y CRUD SQL parametrizado
    ├── views/
    │   └── GalleryView.ts      # DOM, tarjetas, canvas, modales, toasts y estados vacíos
    ├── controllers/
    │   └── StudioController.ts # Casos de uso, validación, eventos y exportación
    ├── utils/
    │   └── generative.ts       # Motor procedural puro y determinista (Canvas 2D)
    └── styles/
        └── styles.css          # Sistema de diseño completo y responsive
```

> `utils/generative.ts` concentra el motor de dibujo puro. La vista lo consume para
> renderizar tarjetas, preview y lightbox; el controlador solo orquesta casos de uso.
> Así se evita que la lógica de negocio dependa del DOM y que la vista hable con SQLite.

### Flujo de una obra

```text
Evento de UI
   ↓
GalleryView (presentación)
   ↓
StudioController (caso de uso + validación)
   ↓
ArtworkModel (SQL parametrizado)
   ↓
database.ts (sql.js) ──→ localStorage (binario Base64)
   ↓
Artwork reconstruida
   ↓
GalleryView renderiza la tarjeta + canvas determinista
```

### Responsabilidades

- **Modelo**: define entidades, valida entradas y ejecuta SQL con parámetros vinculados.
- **Vista**: renderiza estado, captura intención del usuario y gestiona modales/accesibilidad.
- **Controlador**: decide qué hacer, aplica reglas de negocio, coordina modelo y vista.
- **Base de datos**: singleton de conexión, migraciones, seed, log de consultas y persistencia.
- **Utilidades**: PRNG, paletas, algoritmos y exportación PNG; sin estado global mutable.

---

## Base de datos

### Esquema

```sql
CREATE TABLE IF NOT EXISTS artworks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  algorithm   TEXT NOT NULL,
  palette     TEXT NOT NULL,
  seed        INTEGER NOT NULL,
  complexity  INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);
```

Índices creados automáticamente sobre `created_at`, `palette` y `algorithm`.

### Seed inicial

Si la tabla está vacía, se insertan cuatro obras listas para exhibirse:
Deriva orbital, Canto de las cuerdas, Estructura para un silencio y Cartografía del vacío,
con distintas semillas, algoritmos, paletas, autores y fechas.

### Persistencia

- Clave: `synapse-studio.sqlite.v1`
- Formato: binario completo de SQLite exportado con `database.export()`, convertido a Base64.
- Momento: después de cada `INSERT`, `UPDATE` o `DELETE`; también al crear el esquema y el seed.
- Restauración: al iniciar se decodifica el Base64 y se abre la base con `new SQL.Database(bytes)`.
- Tolerancia a fallos: si la copia local está corrupta, se reconstruye un archivo limpio.
- Si `localStorage` no está disponible, la sesión sigue funcionando en memoria y se avisa al usuario.

> Los datos pertenecen al navegador y al perfil actual. No se sincronizan entre dispositivos
> ni entre navegadores. Borrar los datos del sitio reinicia el museo.

### Consultas

Todas las operaciones usan placeholders (`?`) y arreglos de parámetros. La búsqueda se
resuelve con `instr(lower(...))` para evitar comodines accidentales y los filtros se
combinan con `AND` sólo cuando están activos.

---

## Algoritmos y paletas

| Algoritmo | Descripción | Complejidad visual |
| --- | --- | --- |
| **Constelación Geométrica** | Nodos distribuidos por espiral áurea, conexiones a vecinos cercanos, halos y cruces estelares | Red de 15 a 46 nodos |
| **Ondas de Lissajous** | Curvas paramétricas con frecuencias enteras, fases aleatorias y mezcla aditiva | 4 a 9 curvas |
| **Bauhaus Grid** | Retícula de 3 a 6 celdas con círculos, arcos, triángulos, franjas y bloques planos | 9 a 36 motivos |
| **Nebulosa Espiral** | Galaxia de partículas con brazos, polvo, estrellas y núcleo luminoso | 1.800 a 7.100 partículas |

| Paleta | Fondo | Tintas |
| --- | --- | --- |
| **Cyberpunk** | `#08060F` | `#FF2E88`, `#22D3EE`, `#A855F7`, `#FDE047`, `#34D399` |
| **Terracota** | `#1B110C` | `#E07A5F`, `#F2CC8F`, `#D97757`, `#B07D62`, `#F4A261` |
| **Nordic** | `#0A1524` | `#88C0D0`, `#81A1C1`, `#5E81AC`, `#A3BE8C`, `#EBCB8B` |
| **Solaris** | `#170F03` | `#FFB703`, `#FB8500`, `#FFD166`, `#EF476F`, `#F8F9FA` |
| **Monocromo** | `#111114` | `#FAFAFA`, `#E4E4E7`, `#A1A1AA`, `#71717A`, `#D4D4D8` |

Cada render parte de un PRNG **mulberry32** inicializado con la semilla guardada. Cambiar
la resolución del canvas no altera la composición: el dibujo se realiza sobre un sistema
de coordenadas normalizado de 1000 × 1000 y se escala al tamaño final.

---

## Instalación local

Requisitos: **Node.js 20.19+** y npm.

```bash
cd laboratorio03
npm install
npm run dev
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`).

`npm install` ejecuta automáticamente `scripts/copy-wasm.mjs`, que copia:

```text
node_modules/sql.js/dist/sql-wasm.wasm  →  public/sql-wasm.wasm
```

### Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Sincroniza el `.wasm` y levanta Vite en desarrollo |
| `npm run build` | Sincroniza el `.wasm`, ejecuta `tsc` y compila a `dist/` |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run sync:wasm` | Vuelve a copiar el binario de SQLite a `public/` |

### Build de producción

```bash
npm run build
npm run preview
```

El resultado queda en `dist/` y debe incluir:

```text
dist/
├── index.html
├── favicon.svg
├── sql-wasm.wasm
└── assets/
    ├── index-*.js
    └── index-*.css
```

La compilación se verificó sin errores de TypeScript ni advertencias de Vite.

---

## Despliegue en Vercel

### Desde el panel

1. Sube el proyecto a GitHub, GitLab o Bitbucket.
2. En Vercel, selecciona **Add New → Project** e importa el repositorio.
3. Configura:
   - **Root Directory**: `laboratorio03` (si el repositorio contiene más carpetas).
   - **Framework Preset**: `Vite`.
   - **Build Command**: `npm run build`.
   - **Output Directory**: `dist`.
   - **Install Command**: `npm install`.
4. Despliega. No se necesitan variables de entorno.

### Desde la CLI

```bash
npm i -g vercel
cd laboratorio03
vercel
vercel --prod
```

### Por qué el `.wasm` funciona en Vercel

- El binario se copia a `public/` en `postinstall` y también antes de cada build.
- Vite lo publica en la raíz del sitio: `/sql-wasm.wasm`.
- `locateFile` resuelve el archivo contra `document.baseURI`, siempre desde el mismo origen.
- No hay CDN externa, por lo tanto no hay CORS ni rutas de `node_modules` expuestas.
- Vercel sirve `.wasm` con el MIME correcto (`application/wasm`).

Si en algún momento se limpia `public/`, ejecuta `npm run sync:wasm` o vuelve a instalar
las dependencias antes de compilar.

---

## Inspector SQL

El botón **SQLite persistente activo** del header abre un drawer con las últimas
60 sentencias ejecutadas. Cada entrada muestra:

- Tipo de operación (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `SCHEMA`).
- SQL exacto con parámetros visibles.
- Hora, duración y filas/cambios afectados.
- Etiqueta `migration` o `seed` cuando corresponde.

Es una herramienta de transparencia técnica y depuración: permite comprobar que cada
acción de la interfaz se traduce en SQL real ejecutado por SQLite.

---

## Accesibilidad y detalles de ingeniería

- HTML semántico con landmarks, labels asociados y textos alternativos en iconos.
- Modales con `role="dialog"`, `aria-modal`, foco inicial, trampa de foco y retorno al disparador.
- Cierre con `Escape`, atajo `/` para enfocar la búsqueda y navegación por teclado en tarjetas.
- Filtros con `aria-pressed` y contador de resultados anunciado.
- `aria-live` en toasts y en la galería.
- `prefers-reduced-motion` respetado.
- Render determinista: el mismo `seed + algorithm + palette + complexity` produce la misma obra.
- Exportación a 2000 px independiente del tamaño visible de la tarjeta.
- TypeScript estricto con `noUnusedLocals`, `noUncheckedIndexedAccess` y sin `any` explícito en la lógica de la app.
- Consola del navegador limpia: sin errores ni warnings durante la carga, el CRUD ni la exportación.

---

## Estado del proyecto

- [x] Arquitectura MVC completa.
- [x] SQLite con `sql.js` + WASM local.
- [x] Esquema, índices y seed inicial.
- [x] Persistencia Base64 en `localStorage`.
- [x] CRUD parametrizado y filtros combinables.
- [x] Cuatro algoritmos y cinco paletas deterministas.
- [x] Lightbox, edición, borrado, exportación PNG y toasts.
- [x] Inspector SQL en vivo.
- [x] Diseño responsive con sistema de variables.
- [x] `npm run build` limpio y `.wasm` presente en `dist/`.
- [x] Guía de despliegue en Vercel.

---

<div align="center">

**Synapse Studio** · Laboratorio 03
Arte generativo procedimental, conservado del lado del cliente.

</div>
