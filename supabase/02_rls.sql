-- =====================================================================
--  Row Level Security — versión de la PRIMERA entrega
--
--  Alcance actual: toda persona autenticada del distrito puede leer y
--  registrar. Esto cubre el RNF-04 en su nivel básico: sin sesión válida
--  no hay acceso a ningún dato clínico.
--
--  Pendiente para la segunda entrega (Sección 3.3.3 / 3.5.3): restringir
--  por comunidad asignada al brigadista, bloquear la modificación de
--  mediciones ya validadas y limitar los datos de identificación directa
--  del paciente según el rol.
-- =====================================================================

alter table comunidad             enable row level security;
alter table usuario               enable row level security;
alter table paciente              enable row level security;
alter table medicion              enable row level security;
alter table indicador_nutricional enable row level security;
alter table plan_alimentario      enable row level security;
alter table reporte               enable row level security;
alter table registro_auditoria    enable row level security;
alter table rol                   enable row level security;

-- Catálogos: lectura para cualquier sesión autenticada
create policy leer_rol        on rol        for select to authenticated using (true);
create policy leer_comunidad  on comunidad  for select to authenticated using (true);

-- Perfil de usuario: nombre y rol son un directorio interno de personal,
-- no un dato clínico — cualquier sesión autenticada puede leerlo. Es lo
-- que permite que la bitácora de auditoría (RF-14) muestre quién hizo
-- cada acción, no solo la propia. La contraseña y el correo NO están en
-- esta tabla — viven en auth.users, fuera de este alcance.
create policy leer_usuario on usuario for select to authenticated
  using (true);

-- Datos clínicos: lectura y alta para sesiones autenticadas
create policy leer_paciente  on paciente for select to authenticated using (true);
create policy alta_paciente  on paciente for insert to authenticated with check (true);
create policy edit_paciente  on paciente for update to authenticated using (true);

create policy leer_medicion  on medicion for select to authenticated using (true);
create policy alta_medicion  on medicion for insert to authenticated with check (true);

create policy leer_indicador on indicador_nutricional for select to authenticated using (true);
create policy alta_indicador on indicador_nutricional for insert to authenticated with check (true);

create policy leer_plan      on plan_alimentario for select to authenticated using (true);
create policy alta_plan      on plan_alimentario for insert to authenticated with check (true);

create policy leer_reporte   on reporte for select to authenticated using (true);
create policy alta_reporte   on reporte for insert to authenticated with check (true);

-- Auditoría: solo lectura para el usuario; la escritura la hace el trigger
-- (security definer), nunca el cliente.
create policy leer_auditoria on registro_auditoria for select to authenticated using (true);
