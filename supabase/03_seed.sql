-- =====================================================================
--  Datos semilla — San Pedro Sacatepéquez, Guatemala (depto. Guatemala)
--
--  Listado de comunidades proporcionado por el proponente del proyecto.
--  Corresponde a la cabecera, las 3 aldeas oficiales (Buena Vista, Vista
--  Hermosa, Chillaní — ver Wikipedia / SEGEPLAN) y los caseríos y
--  sectores urbanos del distrito.
--
--  Coordenadas: únicamente la cabecera lleva coordenada verificada (el
--  centroide municipal publicado por GeoNames). El resto se deja en
--  NULL a propósito — inventar coordenadas de un caserío específico es
--  peor que no tener ninguna, porque un dato falso con apariencia de
--  preciso es más difícil de detectar que uno ausente. Complétalas para
--  la segunda entrega (RF-06/RF-07) con una de estas dos vías:
--
--    a) Geocodificación: buscar cada nombre en el geocodificador de
--       OpenStreetMap (Nominatim, gratuito, ya forma parte del stack
--       — Sección 3.4.2) y revisar el resultado a ojo sobre el mapa.
--    b) Captura en campo: cuando el brigadista registra la primera
--       medición en cada comunidad, el sistema ya toma la coordenada
--       real del punto de atención (RF-06); esas coordenadas, aunque
--       están a nivel de paciente, sirven para ubicar el sector la
--       primera vez que se visita.
--
--  La opción (a) es más rápida para tener el mapa listo antes de la
--  visita piloto; la opción (b) es más exacta pero depende de haber
--  visitado el lugar. Lo razonable es usar (a) para el corte del 20 de
--  septiembre y refinar con (b) según se acumulen mediciones reales.
-- =====================================================================

insert into comunidad (nombre, latitud, longitud) values
  ('San Pedro Sac.', 14.683333, -90.65),  -- cabecera municipal, coordenada verificada
  ('Tierra Colorada', null, null),
  ('Buena Vista', null, null),
  ('Vista Hermosa', null, null),
  ('El Aguacate', null, null),
  ('Laguna Seca', null, null),
  ('San Martín', null, null),
  ('Las Limas', null, null),
  ('Los Ortíz', null, null),
  ('Cruz de Piedra', null, null),
  ('Bosques de Vista Hermosa I y II', null, null),
  ('San Francisco I y II', null, null),
  ('Chillaní', null, null)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
--  Perfil del primer usuario
--
--  1. Crea la cuenta en Supabase → Authentication → Users → Add user.
--  2. Copia el UUID que aparece en la lista.
--  3. Sustitúyelo abajo y ejecuta este bloque.
-- ---------------------------------------------------------------------
-- insert into usuario (id, nombre, rol_id, comunidad_id)
-- select
--   'PEGA-AQUI-EL-UUID-DEL-USUARIO'::uuid,
--   'Licda. Dariss Virginia López Cifuentes',
--   3,                                   -- 3 = nutricionista
--   id
-- from comunidad where nombre = 'San Pedro Sac.';
