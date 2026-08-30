-- =====================================================================
--  Actualización — Panel resumen y bitácora de auditoría
--
--  Ejecutar UNA VEZ, después de haber aplicado 01_schema.sql, 02_rls.sql
--  y 03_seed.sql. Es seguro volver a ejecutarlo si algo falla a medias:
--  el DROP POLICY IF EXISTS no truena si la política ya no está.
-- =====================================================================

-- La política original de 'usuario' ("cada quien ve solo su propio
-- perfil") impedía que la bitácora de auditoría mostrara el nombre de
-- OTRO usuario — por ejemplo, que la nutricionista vea que fue un
-- brigadista quien dio de alta a un paciente. Se amplía la lectura a
-- cualquier sesión autenticada: es un directorio interno de personal
-- (nombre y rol), no un dato clínico, así que el mismo criterio de
-- "autenticado = acceso" que ya rige paciente/medicion en este primer
-- avance aplica igual aquí. La contraseña y el correo del usuario NO
-- están en esta tabla — viven en auth.users, fuera de este alcance.
drop policy if exists leer_usuario_propio on usuario;

create policy leer_usuario on usuario for select to authenticated
using (true);
