-- =====================================================================
-- CÁLCULO DE LA LÍNEA BASE (PRE-TEST) — Sección 1.2.2.2 / diseño pre-post
-- Sistema de monitoreo nutricional georreferenciado · San Pedro Sac.
--
-- Qué hace
--   Calcula, SOLO CON LECTURA (select), los indicadores de línea base a
--   partir de las mediciones registradas en un período de referencia
--   (los cuadernillos de papel transcritos al sistema). No modifica nada
--   y no devuelve nombres ni datos que identifiquen a los menores.
--
-- Cómo usarlo
--   1. Cambiar las dos fechas de `parametros` (null = sin límite).
--      Usar el período que cubren los cuadernillos de la línea base.
--   2. Pegar el script completo en el SQL Editor de Supabase y ejecutar.
--   3. El resultado es una sola tabla: bloque · indicador · valor · detalle.
--
-- Criterios (para citarlos en el anexo)
--   · Unidad de análisis: un paciente. Se usa su ÚLTIMA medición dentro
--     del período, para no contar dos veces a quien tuvo varios controles.
--   · Z-scores y clasificación: patrones de crecimiento OMS, calculados
--     por la aplicación y guardados en `indicador_nutricional`.
--   · Desnutrición crónica = talla/edad < -2 DE; aguda = peso/talla
--     < -2 DE; bajo peso = peso/edad < -2 DE.
--   · Norma nacional (MSPAS): con peso/talla >= -2 DE el niño no tiene
--     desnutrición aguda y lleva control preventivo (filas 15 y 16).
--   · "Malnutrición" (severidad ≥ 2) incluye desnutrición moderada o
--     severa y también sobrepeso/obesidad, según la clasificación del
--     sistema. "En riesgo" (severidad ≥ 1) añade a los casos en riesgo.
--   · Digitalización, planes alimentarios y tiempo de respuesta: la
--     línea base es 0 / sin dato POR DEFINICIÓN, porque antes del sistema
--     todo es papel (silencio estadístico). Se muestran como constantes
--     documentadas, no como cálculo.
-- =====================================================================

with parametros as (
  select
    null::date as desde,    -- ej.: date '2026-01-01'
    null::date as hasta     -- ej.: date '2026-06-30'
),

mediciones_periodo as (
  select m.*
  from medicion m, parametros p
  where (p.desde is null or m.fecha_medicion >= p.desde)
    and (p.hasta is null or m.fecha_medicion <= p.hasta)
),

ultima as (                       -- última medición de cada paciente
  select distinct on (m.paciente_id)
         m.id, m.paciente_id, m.fecha_medicion,
         i.z_peso_edad, i.z_talla_edad, i.z_peso_talla,
         i.clasificacion, i.severidad
  from mediciones_periodo m
  left join indicador_nutricional i on i.medicion_id = m.id
  order by m.paciente_id, m.fecha_medicion desc, m.creado_en desc
),

base as (
  select
    count(*)                                               as n,
    count(*) filter (where severidad is not null)          as n_clasif,
    count(*) filter (where severidad >= 1)                 as n_riesgo_o_mas,
    count(*) filter (where severidad >= 2)                 as n_malnutricion,
    count(*) filter (where z_talla_edad < -2)              as n_cronica,
    count(*) filter (where z_peso_talla < -2)              as n_aguda,
    count(*) filter (where z_peso_talla >= -2)             as n_sin_aguda,
    count(*) filter (where z_peso_talla >= -2
                       and z_talla_edad < -2)              as n_cronica_sin_aguda,
    count(*) filter (where z_peso_edad  < -2)              as n_bajo_peso
  from ultima
),

filas as (
  select 1 as o, 'Cobertura'::text as bloque,
         'Pacientes con medición en el período'::text as indicador,
         b.n::numeric as valor, 'pacientes (última medición de cada uno)'::text as detalle
  from base b
  union all
  select 2, 'Cobertura', 'Mediciones en el período', count(*)::numeric, 'mediciones' from mediciones_periodo
  union all
  select 3, 'Cobertura', 'Rango de fechas de medición',
         null, coalesce(min(fecha_medicion)::text,'—') || ' a ' || coalesce(max(fecha_medicion)::text,'—')
  from mediciones_periodo
  union all
  select 4, 'Cobertura', 'Pacientes sin clasificación calculada',
         (b.n - b.n_clasif)::numeric, 'revisar: no entran en los porcentajes' from base b

  union all select 10, 'Estado nutricional', 'Malnutrición (severidad ≥ 2)',
         round(100.0 * b.n_malnutricion / nullif(b.n_clasif,0), 2),
         b.n_malnutricion || ' de ' || b.n_clasif || ' pacientes clasificados (%)' from base b
  union all select 11, 'Estado nutricional', 'En riesgo o peor (severidad ≥ 1)',
         round(100.0 * b.n_riesgo_o_mas / nullif(b.n_clasif,0), 2),
         b.n_riesgo_o_mas || ' de ' || b.n_clasif || ' (%)' from base b
  union all select 12, 'Estado nutricional', 'Desnutrición crónica (talla/edad < -2 DE)',
         round(100.0 * b.n_cronica / nullif(b.n_clasif,0), 2),
         b.n_cronica || ' de ' || b.n_clasif || ' (%)' from base b
  union all select 13, 'Estado nutricional', 'Desnutrición aguda (peso/talla < -2 DE)',
         round(100.0 * b.n_aguda / nullif(b.n_clasif,0), 2),
         b.n_aguda || ' de ' || b.n_clasif || ' (%)' from base b
  union all select 15, 'Norma nacional (MSPAS)', 'Sin desnutrición aguda (peso/talla >= -2 DE)',
         round(100.0 * b.n_sin_aguda / nullif(b.n_clasif,0), 2),
         b.n_sin_aguda || ' de ' || b.n_clasif || ' (%): control preventivo' from base b
  union all select 16, 'Norma nacional (MSPAS)', 'Retardo de crecimiento sin desnutrición aguda',
         round(100.0 * b.n_cronica_sin_aguda / nullif(b.n_clasif,0), 2),
         b.n_cronica_sin_aguda || ' de ' || b.n_clasif || ' (%): talla baja con P/T >= -2' from base b
  union all select 14, 'Estado nutricional', 'Bajo peso (peso/edad < -2 DE)',
         round(100.0 * b.n_bajo_peso / nullif(b.n_clasif,0), 2),
         b.n_bajo_peso || ' de ' || b.n_clasif || ' (%)' from base b

  union all
  select 20 + s.sev, 'Distribución por severidad',
         case s.sev when 0 then 'Normal' when 1 then 'En riesgo'
                    when 2 then 'Moderada' else 'Severa' end,
         round(100.0 * count(u.*) / nullif((select n_clasif from base),0), 2),
         count(u.*) || ' pacientes (%)'
  from generate_series(0,3) as s(sev)
  left join ultima u on u.severidad = s.sev
  group by s.sev

  union all
  select 30, 'Línea base de la intervención (por definición)',
         'Registros clínicos digitalizados', 0,
         '% — antes del sistema el registro es 100 % en papel (meta: ≥ 60 % en 6 meses)'
  union all
  select 31, 'Línea base de la intervención (por definición)',
         'Planes alimentarios asignados por mes', 0,
         'planes — no existía plan (menú) asignado; silencio estadístico'
  union all
  select 32, 'Línea base de la intervención (por definición)',
         'Tiempo de respuesta alerta → visita (días)', null,
         'sin dato — los reportes de brigada están en silencio estadístico (meta: −50 %)'
)
select bloque, indicador, valor, detalle
from filas
order by o;

-- ---------------------------------------------------------------------
-- (Opcional) Desglose por comunidad, para el reporte de brecha. Ejecutar
-- aparte: reemplazar el `select` final de arriba por este, conservando
-- los CTE `parametros`, `mediciones_periodo` y `ultima`.
--
--   select c.nombre as comunidad,
--          count(*) as pacientes,
--          count(*) filter (where u.severidad >= 2) as malnutricion,
--          round(100.0 * count(*) filter (where u.severidad >= 2)
--                / nullif(count(u.severidad),0), 1) as pct
--   from ultima u
--   join paciente p  on p.id = u.paciente_id
--   join comunidad c on c.id = p.comunidad_id
--   group by c.nombre order by pct desc nulls last;
-- ---------------------------------------------------------------------
