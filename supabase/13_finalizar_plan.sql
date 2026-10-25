-- =====================================================================
--  13 · Permitir "Finalizar" un plan alimentario
--  Ejecutar UNA VEZ en el SQL Editor de Supabase.
--
--  Por qué el botón no hacía nada:
--    `plan_alimentario` tiene políticas de lectura y de alta, pero ninguna
--    de actualización (02_rls.sql). Con RLS activo, un UPDATE sin política
--    no da error: simplemente no modifica ninguna fila, y la app lo
--    interpretaba como éxito.
--
--  Qué agrega:
--    1. Política de actualización para sesiones autenticadas (igual que
--       `edit_paciente`).
--    2. Columna `finalizado_en`: marca el cierre manual. Hace falta porque
--       un plan con `fecha_fin = hoy` sigue siendo vigente todo el día
--       (la fecha de fin es inclusiva); sin esta marca, "Finalizar" no
--       lo sacaba de la lista de vigentes hasta mañana.
-- =====================================================================

alter table plan_alimentario
  add column if not exists finalizado_en timestamptz;

drop policy if exists edit_plan on plan_alimentario;
create policy edit_plan on plan_alimentario
  for update to authenticated
  using (true) with check (true);
