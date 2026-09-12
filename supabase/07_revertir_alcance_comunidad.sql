-- =====================================================================
--  Actualización — Vuelta a distrito completo visible + control por
--  pantalla/rol (RF-13 ajustado a la realidad operativa)
--
--  Ejecutar UNA VEZ, después de 01 a 05. NO requiere haber corrido
--  06_seguridad_por_comunidad.sql — este script es autocontenido y
--  crea lo que necesita, sin importar si el 06 se aplicó o no.
--
--  POR QUÉ ESTE CAMBIO
--
--  06_seguridad_por_comunidad.sql (si llegaste a correrlo) asumía una
--  estructura de "un brigadista por comunidad", típica de distritos de
--  salud con mucho personal. La realidad operativa de este proyecto es
--  distinta: una o dos personas (la nutricionista central, quizás un
--  auxiliar) cubren el municipio completo. Restringir por comunidad
--  asignada no protege nada en ese escenario — solo estorba, porque
--  esa misma persona necesita ver los pacientes de todas las
--  comunidades para hacer su trabajo.
--
--  RF-13 (Sección 4.2.1) pide "restringir las operaciones disponibles
--  según el rol del usuario autenticado" — no pide, en su redacción
--  original, particionar los datos por zona geográfica. Ese
--  particionamiento fue una decisión de diseño propia al reforzar la
--  seguridad, y se revierte aquí en favor de un control más simple y
--  más fiel al texto del requerimiento: todo el distrito es visible
--  para cualquier sesión autenticada, y lo que cambia según el rol es
--  qué PANTALLAS puede abrir cada quien — no qué PACIENTES puede ver.
-- =====================================================================

-- Se crea aquí (con create OR REPLACE, así que no falla si 06 ya la
-- había creado antes). Es la única pieza de 06 que este script sigue
-- necesitando — el resto de esa migración queda revertido abajo.
create or replace function mi_rol_id()
returns smallint language sql stable security definer
set search_path = public as $$
  select rol_id from usuario where id = auth.uid()
$$;

-- Volver a la regla simple: cualquier sesión autenticada lee/escribe,
-- sin importar la comunidad. Mismo criterio que ya rige
-- plan_alimentario y reporte desde el primer avance. Los DROP POLICY
-- son seguros de correr tanto si vienes del 02 solo como si ya
-- pasaste por el 06 — en ambos casos la política existe con ese
-- nombre y se reemplaza limpiamente.
drop policy if exists leer_paciente on paciente;
create policy leer_paciente on paciente for select to authenticated
using (true);

drop policy if exists alta_paciente on paciente;
create policy alta_paciente on paciente for insert to authenticated
with check (true);

drop policy if exists edit_paciente on paciente;
create policy edit_paciente on paciente for update to authenticated
using (true);

drop policy if exists leer_medicion on medicion;
create policy leer_medicion on medicion for select to authenticated
using (true);

drop policy if exists alta_medicion on medicion;
create policy alta_medicion on medicion for insert to authenticated
with check (true);

drop policy if exists leer_indicador on indicador_nutricional;
create policy leer_indicador on indicador_nutricional for select to authenticated
using (true);

-- Si venías del 06, esta función ya no la usa ninguna política — se
-- elimina para no dejar código muerto. Si nunca corriste el 06, esto
-- simplemente no hace nada (IF EXISTS).
drop function if exists mi_comunidad_id();

-- ---------------------------------------------------------------------
--  Control por rol a nivel de pantalla, con respaldo en la base de
--  datos (no solo en la interfaz — ver también src/componentes/
--  RutaProtegida.jsx del lado de la aplicación).
--
--  Reportes de control (brecha nutricional, tiempos de respuesta):
--  gestión — nutricionista, director, administrador.
--  Bitácora de auditoría: supervisión institucional — director,
--  administrador únicamente.
-- ---------------------------------------------------------------------

drop policy if exists leer_reporte on reporte;
create policy leer_reporte on reporte for select to authenticated
using (mi_rol_id() in (3, 4, 5));

drop policy if exists leer_auditoria on registro_auditoria;
create policy leer_auditoria on registro_auditoria for select to authenticated
using (mi_rol_id() in (4, 5));
