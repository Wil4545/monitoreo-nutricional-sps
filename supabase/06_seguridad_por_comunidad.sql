-- =====================================================================
--  Actualización — Seguridad reforzada por comunidad (RF-13)
--
--  Ejecutar UNA VEZ, después de 01 a 05.
--
--  ⚠️  LEE ESTO ANTES DE CORRERLO — cambia lo que ves en la app  ⚠️
--
--  Hasta ahora, cualquier sesión autenticada veía TODOS los pacientes
--  del distrito, sin importar su comunidad (Sección 3.3.3 lo dejaba
--  pendiente a propósito para el primer avance). Este script activa la
--  regla real: cada usuario ve solo los pacientes de SU comunidad
--  asignada. Los roles 4 (director) y 5 (administrador) son la
--  excepción — ellos siguen viendo todo el distrito, porque así lo
--  necesitan para los reportes de control (RF-09).
--
--  Si tu usuario de prueba tiene rol 1, 2 o 3 (auxiliar, brigadista o
--  nutricionista) y está asignado a una sola comunidad, después de
--  correr esto el panel, la lista de pacientes, el mapa y los reportes
--  se van a ver MÁS VACÍOS que antes — es el comportamiento correcto,
--  no un error. Para seguir viendo el distrito completo durante tus
--  pruebas o en la defensa, sube tu usuario de prueba a rol 5:
--
--    update usuario set rol_id = 5 where id = 'TU-UUID-AQUI';
--
--  (el UUID es el mismo que usaste en el paso 4 del README para crear
--  tu primer usuario).
-- =====================================================================

-- Funciones de apoyo: leen una sola vez el perfil del usuario que hace
-- la consulta, para no repetir el mismo subquery en cada política.
-- `security definer` + `search_path` fijo es la forma segura de
-- escribir estas funciones (evita que alguien manipule search_path
-- para redirigirlas a una tabla falsa).
create or replace function mi_comunidad_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select comunidad_id from usuario where id = auth.uid()
$$;

create or replace function mi_rol_id()
returns smallint language sql stable security definer
set search_path = public as $$
  select rol_id from usuario where id = auth.uid()
$$;

-- PACIENTE — leer, registrar y modificar, restringido a la comunidad
-- asignada (salvo director/administrador).
drop policy if exists leer_paciente on paciente;
create policy leer_paciente on paciente for select to authenticated
using (mi_rol_id() in (4, 5) or comunidad_id = mi_comunidad_id());

drop policy if exists alta_paciente on paciente;
create policy alta_paciente on paciente for insert to authenticated
with check (mi_rol_id() in (4, 5) or comunidad_id = mi_comunidad_id());

drop policy if exists edit_paciente on paciente;
create policy edit_paciente on paciente for update to authenticated
using (mi_rol_id() in (4, 5) or comunidad_id = mi_comunidad_id());

-- MEDICION — no tiene comunidad_id propia; se llega a ella a través
-- del paciente al que pertenece.
drop policy if exists leer_medicion on medicion;
create policy leer_medicion on medicion for select to authenticated
using (
  mi_rol_id() in (4, 5)
  or exists (
    select 1 from paciente p
    where p.id = medicion.paciente_id and p.comunidad_id = mi_comunidad_id()
  )
);

drop policy if exists alta_medicion on medicion;
create policy alta_medicion on medicion for insert to authenticated
with check (
  mi_rol_id() in (4, 5)
  or exists (
    select 1 from paciente p
    where p.id = medicion.paciente_id and p.comunidad_id = mi_comunidad_id()
  )
);

-- INDICADOR_NUTRICIONAL — mismo criterio, un salto más lejos
-- (indicador → medición → paciente → comunidad). Sin esto, alguien
-- podría consultar esta tabla directo y ver clasificaciones de
-- pacientes fuera de su comunidad aunque ya no pudiera ver la
-- medición ni el paciente correspondientes.
drop policy if exists leer_indicador on indicador_nutricional;
create policy leer_indicador on indicador_nutricional for select to authenticated
using (
  mi_rol_id() in (4, 5)
  or exists (
    select 1 from medicion m join paciente p on p.id = m.paciente_id
    where m.id = indicador_nutricional.medicion_id and p.comunidad_id = mi_comunidad_id()
  )
);
