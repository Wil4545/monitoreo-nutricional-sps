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
   hizo cada acción. **Ejecútalo aunque ya hayas corrido los tres
   primeros antes en una instalación previa** — está escrito para
   aplicarse sobre una base ya existente sin duplicar nada.

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
  04_actualizacion_panel_auditoria.sql  Migración: lectura de usuario

src/
  lib/oms/
    lms.js            Tablas L, M, S oficiales de la OMS (0-60 meses)
    zscore.js         Cálculo de puntajes Z (RF-03)
    clasificacion.js  Reglas de clasificación nutricional (RF-04)
  lib/
    supabase.js       Cliente de conexión
    registro.js        Guardar medición + historial de un paciente
    formato.js         Utilidades de fecha, edad y formato numérico
    demo.js             Datos ficticios para /demostracion
  componentes/
    GraficoTrayectoria.jsx  Gráfico de dispersión con tendencia (RF-05)
    Interfaz.jsx             Barra, campos, botones, insignias
  paginas/
    Ingreso.jsx
    Panel.jsx                Panel resumen — pantalla de entrada
    ListaPacientes.jsx
    NuevoPaciente.jsx        RF-01
    NuevaMedicion.jsx        RF-02, RF-03, RF-04
    FichaPaciente.jsx        Reporte operativo (Sección 4.3.1)
    Auditoria.jsx             Consulta de la bitácora — RF-14, RNF-10
    Demostracion.jsx

pruebas/
  validar-oms.mjs           Suite de validación del motor de puntajes Z
  referencia-oms-sd.json    Tablas SD oficiales usadas como referencia

vercel.json / netlify.toml  Reescritura SPA para desplegar en producción
```

## Pendiente para la segunda entrega (20 de septiembre)

- RF-06, RF-07 — georreferenciación y mapa de calor con Leaflet.js
- RF-08, RF-09 — reportes de control agregados (brecha nutricional por
  comunidad, tiempos de respuesta) más allá de la ficha individual y el
  panel resumen, que ya están listos
- RF-13 reforzado — políticas RLS por comunidad asignada al usuario (hay
  una propuesta ya redactada y discutida, pendiente de aplicar)
- RF-11, RF-12 — operación sin conexión y sincronización (ver la
  recomendación de alcance discutida en la planificación de entregas)
- RNF-07 — manifiesto de aplicación web y Service Worker, para que la
  PWA sea instalable y no solo responsiva
