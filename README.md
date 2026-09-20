# Monitoreo Nutricional · San Pedro Sacatepéquez

Primer entregable de desarrollo — Proyecto de Graduación I, Wilson Emanuel Arriaga Pérez.

Cubre RF-01, RF-02, RF-03, RF-04 y RF-05 del catálogo de requerimientos
(Sección 4.2.1), más la estructura de base de datos completa (Figura 5) y
una versión inicial del control de acceso por roles (RF-13).

## 1. Requisitos

- Node.js 18 o superior
- Una cuenta gratuita en [supabase.com](https://supabase.com)

## 2. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Elige una región cercana (por ejemplo, `us-east-1`) y una contraseña
   de base de datos — guárdala, la pedirás pocas veces pero es difícil
   de recuperar si la pierdes.
3. Espera a que el proyecto termine de aprovisionarse (1–2 minutos).

## 3. Ejecutar el esquema

En el panel de Supabase, abre **SQL Editor** → **New query** y ejecuta,
**en este orden**, el contenido de cada archivo de `supabase/`:

1. `01_schema.sql` — crea las 9 tablas, la vista y los triggers de auditoría.
2. `02_rls.sql` — activa las políticas de seguridad a nivel de fila.
3. `03_seed.sql` — carga las comunidades del municipio.
4. `04_actualizacion_panel_auditoria.sql` — amplía la lectura de `usuario`
   para que la bitácora de auditoría pueda mostrar el nombre de quien
   hizo cada acción.
5. `05_vista_ubicaciones.sql` — agrega las coordenadas a la vista que
   usa el panel (columnas que ya no usa el mapa por defecto — ver el
   script 8 — pero se conservan por si más adelante quieres una capa
   con visitas reales de brigadistas).
6. `06_seguridad_por_comunidad.sql` — **opcional, puedes saltarlo.**
   Fue un primer intento de restringir el acceso por comunidad
   asignada; se descartó al comprobar que no refleja cómo opera un
   distrito con una o dos personas cubriendo todo el municipio. Se
   conserva en el repositorio como registro del proceso de diseño
   (útil para narrar en la Sección 4.1.3 "Aprendizajes obtenidos"),
   pero **no hace falta correrlo** — el script 7 no depende de él.
7. `07_revertir_alcance_comunidad.sql` — el criterio vigente de RF-13.
   Muestra todo el distrito a cualquier sesión autenticada, y controla
   el acceso a nivel de pantalla: Reportes de control requiere rol
   nutricionista/director/administrador, y la Bitácora de auditoría
   requiere director/administrador. **Corre este directamente después
   del 5, sin necesidad de pasar por el 6.**
8. `08_coordenadas_comunidades.sql` — coordenadas reales (verificadas
   contra OpenStreetMap) para 7 de las 13 comunidades del catálogo. El
   mapa (RF-06/RF-07) ubica a cada paciente por su comunidad de
   residencia, no por el GPS del dispositivo en el momento del
   registro — léelo antes de correrlo, trae el detalle de por qué y
   cuáles comunidades faltan.
9. `09_coordenadas_pendientes.sql` — completa las 6 comunidades que
   faltaban en el script 8 (Tierra Colorada, San Martín, Los Ortíz,
   Bosques de Vista Hermosa I y II, San Francisco I y II, Chillaní).
   Con este script, las 13 comunidades quedan con coordenada.
10. `10_plan_alimentario_estructura.sql` — agrega a `plan_alimentario`
    las columnas que usa el generador automático de planes (RF-10):
    `macronutrientes` (los que se marcaron) y `menu_sugerido` (el
    menú-guía generado, guardado tal como se presentó).
11. `11_auditoria_minimizada.sql` — RNF-05. Reemplaza el trigger de
    auditoría para que, en `paciente`, ya no duplique nombre completo,
    fecha de nacimiento ni datos del tutor dentro de `registro_auditoria`
    — guarda el código del paciente y, en una modificación, solo qué
    columnas cambiaron (no sus valores).

Los scripts del 4 en adelante están escritos para aplicarse sobre una
base que ya tiene datos — puedes correrlos aunque ya hayas ejecutado una
versión anterior del proyecto.

Cada archivo se pega completo y se ejecuta con **Run**. Si alguno falla,
revisa el mensaje de error antes de continuar al siguiente: normalmente
significa que el anterior no se ejecutó por completo.

## 4. Crear tu primer usuario

1. En Supabase: **Authentication → Users → Add user → Create new user**.
   Usa tu correo y una contraseña.
2. Copia el UUID que aparece junto al usuario recién creado.
3. Vuelve a **SQL Editor** y ejecuta (sustituyendo el UUID y, si quieres,
   el nombre):

   ```sql
   insert into usuario (id, nombre, rol_id, comunidad_id)
   select
     'PEGA-AQUI-EL-UUID'::uuid,
     'Tu nombre',
     3,                                   -- 3 = nutricionista, ver tabla rol
     id
   from comunidad where nombre = 'San Pedro Sac.';
   ```

   Códigos de rol: `1` auxiliar/técnico · `2` brigadista · `3` nutricionista
   · `4` director · `5` administrador.

   Todos los roles ven el distrito completo (no se restringe por
   comunidad — ver `07_revertir_alcance_comunidad.sql`). Lo que cambia
   según el rol es el acceso a dos pantallas: **Reportes de control**
   requiere rol `3`, `4` o `5`; **Bitácora de auditoría** requiere rol
   `4` o `5`. Para ver todo durante pruebas o la defensa, usa rol `5`.

## 5. Conectar la aplicación

1. En Supabase: **Project Settings → API**. Copia **Project URL** y la
   clave **anon public**.
2. En la carpeta del proyecto:

   ```bash
   cp .env.example .env
   ```

   Abre `.env` y pega los dos valores.

## 6. Instalar y ejecutar

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (normalmente `http://localhost:5173`)
e inicia sesión con el correo y contraseña que creaste en el paso 4.

## Desplegar en una URL real (Vercel o Netlify)

El proyecto ya trae los archivos de configuración (`vercel.json`,
`netlify.toml`) para que el enrutamiento de React funcione al recargar
una página interna como `/pacientes/xyz` — sin ellos, el servidor
devolvería un 404 en cualquier ruta que no sea la raíz. Lo que sigue es
manual porque requiere tu cuenta; no es algo que se pueda automatizar
desde aquí.

### Con Vercel (recomendado, más simple)

1. Sube el proyecto a un repositorio de GitHub:
   ```bash
   git init
   git add .
   git commit -m "Primer avance de desarrollo"
   ```
   Crea un repositorio vacío en GitHub y sigue las instrucciones que te
   da para conectar tu carpeta local (`git remote add origin ...` y
   `git push`).
2. Entra a [vercel.com](https://vercel.com) → **Add New → Project** →
   importa ese repositorio.
3. Antes de darle a **Deploy**, abre **Environment Variables** y agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   con los mismos valores de tu `.env` local. Vite las necesita **en el
   momento de compilar**, así que si las agregas después de desplegar,
   tienes que volver a desplegar para que tomen efecto.
4. **Deploy**. En un par de minutos te da una URL pública
   (`algo.vercel.app`).

### Con Netlify

Mismo flujo: conectar el repositorio desde **Add new site → Import an
existing project**, configurar las mismas dos variables de entorno en
**Site settings → Environment variables**, y desplegar. `netlify.toml`
ya le indica el comando de build (`npm run build`) y la carpeta a
publicar (`dist`).

### Un ajuste en Supabase que conviene hacer después de desplegar

En Supabase: **Authentication → URL Configuration**, agrega tu URL de
producción (`https://tu-proyecto.vercel.app`) en **Site URL** o en
**Redirect URLs**. Con el inicio de sesión por correo y contraseña que
usa este avance no es estrictamente necesario, pero sí lo será en cuanto
se agregue cualquier flujo que dependa de un enlace por correo
(recuperar contraseña, invitaciones) — mejor dejarlo configurado ahora
que acordarse después.

## Ver la demostración sin configurar nada

Con el servidor corriendo (`npm run dev`), visita `/demostracion`. Muestra
la ficha de seguimiento y la trayectoria con tres pacientes de ejemplo,
sin necesidad de cuenta ni conexión a Supabase. Útil para mostrar el
avance al asesor.

## Verificar el motor de puntajes Z

El cálculo de puntajes Z se validó contra las 728 filas de las tablas
oficiales de la OMS (0–60 meses), reconstruyendo las 7 curvas de
desviación estándar desde los parámetros L, M, S — 5,096 comparaciones en
total. Para volver a correr esa validación:

```bash
npm run prueba:oms
```

## Estructura del proyecto

```
supabase/            Esquema SQL — ejecutar una sola vez en Supabase
  01_schema.sql       Tablas, vista, triggers de auditoría
  02_rls.sql          Políticas de seguridad a nivel de fila
  03_seed.sql         Comunidades del municipio
  04_actualizacion_panel_auditoria.sql    Migración: lectura de usuario
  05_vista_ubicaciones.sql                Migración: coordenadas para el mapa
  06_seguridad_por_comunidad.sql          Migración: RLS por comunidad (superada)
  07_revertir_alcance_comunidad.sql       Migración: acceso por pantalla/rol (vigente)
  08_coordenadas_comunidades.sql          Migración: coordenadas reales (7 de 13 comunidades)
  09_coordenadas_pendientes.sql           Migración: coordenadas reales (13 de 13 comunidades)
  10_plan_alimentario_estructura.sql      Migración: generador de planes alimentarios (RF-10)
  11_auditoria_minimizada.sql             Migración: bitácora sin PII de menores (RNF-05)

src/
  lib/oms/
    lms.js            Tablas L, M, S oficiales de la OMS (0-60 meses)
    zscore.js         Cálculo de puntajes Z (RF-03)
    clasificacion.js  Reglas de clasificación nutricional (RF-04)
  lib/
    supabase.js       Cliente de conexión
    registro.js        Mediciones, historial, reportes y planes alimentarios (RF-09, RF-10)
    nutricion.js        Catálogo de alimentos y generador de menú-guía (RF-10)
    pdfPlan.js           Genera el PDF descargable del plan (RF-10)
    offline.js           Cola de mediciones sin conexión (RF-11, RF-12)
    formato.js         Utilidades de fecha, edad y formato numérico
    demo.js             Datos ficticios para /demostracion
  componentes/
    GraficoTrayectoria.jsx  Gráfico de dispersión con tendencia (RF-05)
    CapaCalor.jsx             Mapa de calor sobre Leaflet (RF-07)
    RutaProtegida.jsx          Candado de pantalla por rol (RF-13)
    EstadoSincronizacion.jsx   Aviso global de mediciones pendientes (RF-12)
    Interfaz.jsx             Barra, campos, botones, insignias, selector múltiple
  paginas/
    Ingreso.jsx
    Panel.jsx                Panel resumen — pantalla de entrada
    ListaPacientes.jsx
    NuevoPaciente.jsx        RF-01
    NuevaMedicion.jsx        RF-02, RF-03, RF-04
    FichaPaciente.jsx        Reporte operativo (Sección 4.3.1)
    PlanesAlimentarios.jsx    Generador de planes + descarga en PDF — RF-10
    Mapa.jsx                  Mapa de calor por comunidad — RF-06, RF-07
    Reportes.jsx               Brecha nutricional y tiempos — RF-09
    Auditoria.jsx             Consulta de la bitácora — RF-14, RNF-10
    Demostracion.jsx

public/
  manifest.webmanifest    Metadatos de instalación — RNF-07
  sw.js                    Service Worker, cachea el cascarón de la app — RNF-07
  icono-192.png / icono-512.png / icono-180.png

pruebas/
  validar-oms.mjs           Suite de validación del motor de puntajes Z
  referencia-oms-sd.json    Tablas SD oficiales usadas como referencia

vercel.json / netlify.toml  Reescritura SPA para desplegar en producción
```

## Ajustes de localización (post-entrega)

- **Fechas en DD/MM/AAAA**: `src/lib/formato.js` (`fechaCorta`, `fechaHoraCorta`)
  es la única fuente de formato de fecha en toda la app — se cambió ahí,
  una vez, y se propaga a Ficha, Lista, Reportes, Auditoría, el PDF del
  plan alimentario y el gráfico de trayectoria. **Excepción fuera de
  nuestro control**: los campos `<input type="date">` (fecha de la cita,
  fecha de nacimiento, fechas del plan) son controles nativos del
  navegador — su calendario visual respeta el idioma/región configurado
  en el sistema operativo o el navegador, no algo que la app pueda forzar
  con CSS o JS. En un navegador configurado en español de Guatemala ya
  muestra DD/MM/AAAA; solo se vería distinto si el dispositivo está en
  otro idioma/región.
- **Peso en libras y onzas**: en Nueva medición (`src/paginas/NuevaMedicion.jsx`),
  además del campo de kilogramos (el que exige la OMS y guarda la base de
  datos), hay dos campos — libras y onzas — que se convierten solos hacia
  y desde kilogramos en `src/lib/peso.js`. Escribes en cualquiera de los
  tres y los otros se autocompletan; solo el kilogramo se guarda en
  `medicion.peso_kg` (no se agregó ninguna columna nueva, es únicamente
  una ayuda de captura).

## Pendiente para la próxima entrega

- ~~Coordenadas de las 6 comunidades que faltaban~~ — completadas en
  `supabase/09_coordenadas_pendientes.sql`. Las 13 comunidades del
  catálogo tienen coordenada.
- ~~RF-10 — asignación de planes alimentarios~~ — completado y
  automatizado: la nutricionista marca los macronutrientes a reforzar
  (preseleccionados según la clasificación vigente del paciente, RF-04),
  `src/lib/nutricion.js` propone alimentos accesibles en la zona y un
  menú-guía de 5 tiempos, y cada plan se descarga como PDF de una página
  (`src/lib/pdfPlan.js`, con jsPDF) para entregar al tutor. Requiere
  correr `supabase/10_plan_alimentario_estructura.sql`.
- ~~RNF-07 — instalabilidad como PWA~~ — completado: `manifest.webmanifest`
  + `sw.js` cachean el cascarón de la app (HTML/JS/CSS/iconos), lo que
  habilita "Instalar aplicación" en el navegador. **Alcance acotado a
  propósito**: el Service Worker no cachea datos de Supabase ni permite
  registrar mediciones sin conexión — eso sigue siendo RF-11/RF-12, no
  esto. Ver el comentario al inicio de `public/sw.js`.
- ~~RF-11, RF-12 — operación sin conexión y sincronización~~ — **alcance
  acotado**, implementado en `src/lib/offline.js`: si al guardar una
  medición no hay red, se guarda en este dispositivo (`localStorage`) y
  se sincroniza sola al recuperar señal, o con el botón "Sincronizar
  ahora" que aparece en cualquier pantalla (`EstadoSincronizacion.jsx`).
  Verificado con Playwright simulando la app sin conexión: la medición
  se encola sin llegar a la red, y al reconectar se sincroniza sin
  intervención.
  **Lo que NO cubre este alcance** (documentado también en el propio
  `offline.js`): no hay resolución de conflictos si dos dispositivos
  registraran la misma cita mientras ambos están sin conexión —cada uno
  se sincronizaría como una cita separada—, y solo cubre el flujo de
  *guardar una medición*, no cachear catálogos para *consultar*
  pacientes o comunidades sin conexión. Un verdadero RF-11/RF-12 con
  resolución de conflictos sigue siendo trabajo futuro, pero el caso de
  uso principal (no perder una medición por falta de señal en campo) ya
  funciona.
- ~~RNF-05 — minimización y seudonimización de datos de menores~~ —
  completado en `supabase/11_auditoria_minimizada.sql`: la bitácora de
  auditoría (`registro_auditoria`) ya no duplica nombre completo, fecha
  de nacimiento ni datos del tutor de un paciente menor de cinco años;
  guarda el código pseudónimo (SPS-AAAA-NNNN) y, en una edición, solo la
  lista de columnas que cambiaron. Las pantallas de atención directa
  (Ficha, Lista, Nueva medición) siguen mostrando el nombre completo a
  propósito — el personal necesita identificar al niño correcto — la
  minimización se aplicó donde el dato no aportaba nada al propósito del
  registro (trazabilidad de acciones, no consulta clínica).
