-- =====================================================================
--  Limpieza de datos de prueba — deja el sistema vacío de pacientes
--
--  QUÉ BORRA
--    · Todos los pacientes y, por cascada de llaves foráneas, sus
--      mediciones, indicadores nutricionales y planes alimentarios.
--    · Las filas de la bitácora de auditoría (`registro_auditoria`)
--      sobre `paciente` y `medicion` — incluidas las de tipo "baja" que
--      este mismo borrado genera, para que la bitácora quede limpia.
--
--  QUÉ NO TOCA
--    · Comunidades (nombres y coordenadas), roles, usuarios, el esquema,
--      las vistas, los triggers y las políticas RLS.
--    · La tabla `reporte` (bitácora de reportes consultados). Ver el
--      PASO 3, que es opcional y está comentado.
--
--  CÓMO USARLO (SQL Editor de Supabase)
--    1. Corre SOLO el PASO 1 (conteos) para ver qué se va a borrar.
--    2. Si coincide con lo esperado, corre el PASO 2 completo
--       (BEGIN ... COMMIT) de una sola vez.
--    3. Corre de nuevo el PASO 1: todos los conteos deben dar 0.
--
--  ES IRREVERSIBLE. Si hay algo real mezclado con lo inventado, haz
--  primero un respaldo (Table Editor → paciente → Export → CSV).
--
--  EFECTO SOBRE LOS CÓDIGOS: la app genera el código del siguiente
--  paciente como (total de pacientes + 1), así que tras vaciar la tabla
--  el próximo registro será SPS-AAAA-0001.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 — Conteos (solo lectura)
-- ---------------------------------------------------------------------
select 'paciente'              as tabla, count(*) as filas from paciente
union all select 'medicion',              count(*) from medicion
union all select 'indicador_nutricional', count(*) from indicador_nutricional
union all select 'plan_alimentario',      count(*) from plan_alimentario
union all select 'registro_auditoria (paciente/medicion)', count(*)
  from registro_auditoria where entidad in ('paciente', 'medicion')
union all select 'comunidad (se conserva)', count(*) from comunidad;


-- ---------------------------------------------------------------------
-- PASO 2 — Borrado (transacción: o se hace todo o no se hace nada)
-- ---------------------------------------------------------------------
begin;

  -- medicion, indicador_nutricional y plan_alimentario caen solos por
  -- `on delete cascade` desde paciente.
  delete from paciente;

  -- El borrado de arriba dispara fn_auditar() y deja filas "baja";
  -- se limpian después, junto con las "alta" de las pruebas.
  delete from registro_auditoria where entidad in ('paciente', 'medicion');

commit;


-- ---------------------------------------------------------------------
-- PASO 3 (OPCIONAL) — Bitácora de reportes
--
-- `reporte` guarda qué reportes se consultaron y, en el caso de
-- "registros_digitalizados", los totales que capturaste a mano durante
-- las pruebas. No es un dato de pacientes, por eso no se borra por
-- defecto. Si esas mediciones de prueba no deben aparecer en la
-- presentación, descomenta una de las dos líneas:
-- ---------------------------------------------------------------------
-- delete from reporte where tipo = 'registros_digitalizados';   -- solo el histórico de digitalización
-- delete from reporte;                                          -- toda la bitácora de reportes
