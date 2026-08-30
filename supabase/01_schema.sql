-- =====================================================================
--  Sistema de Monitoreo Nutricional — San Pedro Sacatepéquez
--  Esquema relacional (PostgreSQL / Supabase)
--  Corresponde al modelo entidad-relación de la Figura 5 (Sección 4.3.3)
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- ROL — perfiles de acceso (Sección 3.3.3, RF-13)
-- ---------------------------------------------------------------------
create table rol (
  id          smallint primary key,
  codigo      text not null unique,
  nombre      text not null,
  descripcion text
);

insert into rol (id, codigo, nombre, descripcion) values
  (1, 'auxiliar',     'Auxiliar de enfermería / Técnico en salud', 'Registra pacientes y mediciones en el centro de salud.'),
  (2, 'brigadista',   'Brigadista',                                'Registra pacientes y mediciones en campo.'),
  (3, 'nutricionista','Nutricionista',                             'Registra mediciones y asigna planes alimentarios.'),
  (4, 'director',     'Director del centro de salud',              'Consulta reportes agregados de todo el distrito.'),
  (5, 'admin',        'Administrador del sistema',                 'Gestiona usuarios, roles y comunidades.');

-- ---------------------------------------------------------------------
-- COMUNIDAD — unidades geográficas de cobertura (Sección 2.2.1)
-- ---------------------------------------------------------------------
create table comunidad (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null unique,
  sector     text,
  latitud    double precision,
  longitud   double precision,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- USUARIO — extiende auth.users de Supabase
-- ---------------------------------------------------------------------
create table usuario (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombre       text not null,
  rol_id       smallint not null references rol(id),
  comunidad_id uuid references comunidad(id),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PACIENTE — menores de cinco años bajo monitoreo (RF-01)
-- ---------------------------------------------------------------------
create table paciente (
  id                uuid primary key default uuid_generate_v4(),
  codigo            text not null unique,
  nombre            text not null,
  apellido          text not null,
  fecha_nacimiento  date not null,
  sexo              char(1) not null check (sexo in ('M','F')),
  comunidad_id      uuid not null references comunidad(id),
  tutor_nombre      text,
  tutor_telefono    text,
  creado_por        uuid references usuario(id),
  creado_en         timestamptz not null default now(),
  constraint fecha_nacimiento_valida check (fecha_nacimiento <= current_date)
);

create index idx_paciente_comunidad on paciente(comunidad_id);
create index idx_paciente_nombre    on paciente(lower(apellido), lower(nombre));

-- ---------------------------------------------------------------------
-- MEDICION — captura antropométrica por cita (RF-02, RF-06)
-- ---------------------------------------------------------------------
create table medicion (
  id              uuid primary key default uuid_generate_v4(),
  paciente_id     uuid not null references paciente(id) on delete cascade,
  fecha_medicion  date not null,
  peso_kg         numeric(5,2) not null check (peso_kg  between 0.5 and 60),
  talla_cm        numeric(5,1) not null check (talla_cm between 30 and 150),
  medido_acostado boolean not null default false,
  latitud         double precision,
  longitud        double precision,
  observaciones   text,
  registrado_por  uuid references usuario(id),
  creado_en       timestamptz not null default now(),
  constraint fecha_medicion_valida check (fecha_medicion <= current_date)
);

create index idx_medicion_paciente on medicion(paciente_id, fecha_medicion);

-- ---------------------------------------------------------------------
-- INDICADOR_NUTRICIONAL — puntajes Z derivados (RF-03, RF-04)
-- Relación 1:1 con MEDICION; se persiste para no recalcular en consulta.
-- ---------------------------------------------------------------------
create table indicador_nutricional (
  medicion_id    uuid primary key references medicion(id) on delete cascade,
  edad_meses     numeric(6,2) not null,
  z_peso_edad    numeric(5,2),
  z_talla_edad   numeric(5,2),
  z_peso_talla   numeric(5,2),
  clasificacion  text not null,
  severidad      smallint not null,   -- 0 normal · 1 riesgo · 2 moderada · 3 severa
  calculado_en   timestamptz not null default now()
);

create index idx_indicador_severidad on indicador_nutricional(severidad);

-- ---------------------------------------------------------------------
-- PLAN_ALIMENTARIO — RF-10 (previsto para la segunda entrega)
-- ---------------------------------------------------------------------
create table plan_alimentario (
  id            uuid primary key default uuid_generate_v4(),
  paciente_id   uuid not null references paciente(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  costo_diario  numeric(7,2),
  fecha_inicio  date not null default current_date,
  fecha_fin     date,
  asignado_por  uuid references usuario(id),
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- REPORTE — bitácora de reportes generados (RF-08, RF-09)
-- ---------------------------------------------------------------------
create table reporte (
  id            uuid primary key default uuid_generate_v4(),
  tipo          text not null,
  parametros    jsonb,
  generado_por  uuid references usuario(id),
  generado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- REGISTRO_AUDITORIA — trazabilidad (RF-14, RNF-10)
-- ---------------------------------------------------------------------
create table registro_auditoria (
  id           bigserial primary key,
  usuario_id   uuid references usuario(id),
  entidad      text not null,
  entidad_id   uuid,
  accion       text not null check (accion in ('alta','modificacion','consulta','baja')),
  detalle      jsonb,
  ocurrido_en  timestamptz not null default now()
);

create index idx_auditoria_entidad on registro_auditoria(entidad, entidad_id);
create index idx_auditoria_fecha   on registro_auditoria(ocurrido_en desc);

-- ---------------------------------------------------------------------
-- Vista de apoyo: última medición y clasificación vigente por paciente
-- ---------------------------------------------------------------------
create or replace view v_paciente_estado as
select distinct on (p.id)
  p.id, p.codigo, p.nombre, p.apellido, p.sexo, p.fecha_nacimiento,
  c.nombre  as comunidad,
  m.fecha_medicion, m.peso_kg, m.talla_cm,
  i.z_peso_edad, i.z_talla_edad, i.z_peso_talla,
  i.clasificacion, i.severidad
from paciente p
join comunidad c on c.id = p.comunidad_id
left join medicion m on m.paciente_id = p.id
left join indicador_nutricional i on i.medicion_id = m.id
order by p.id, m.fecha_medicion desc nulls last;

-- ---------------------------------------------------------------------
-- Trigger de auditoría (RF-14)
-- ---------------------------------------------------------------------
create or replace function fn_auditar()
returns trigger language plpgsql security definer as $$
begin
  insert into registro_auditoria (usuario_id, entidad, entidad_id, accion, detalle)
  values (
    auth.uid(),
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'modificacion' else 'baja' end,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger tg_auditar_paciente
  after insert or update or delete on paciente
  for each row execute function fn_auditar();

create trigger tg_auditar_medicion
  after insert or update or delete on medicion
  for each row execute function fn_auditar();
