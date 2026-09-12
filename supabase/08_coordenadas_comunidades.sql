-- =====================================================================
--  Actualización — Coordenadas reales de comunidades
--
--  Ejecutar UNA VEZ, después de 01 a 07. Actualiza `comunidad` (ya
--  poblada por 03_seed.sql) con coordenadas verificadas para el mapa.
--
--  POR QUÉ ESTO IMPORTA
--
--  Hasta ahora el mapa ubicaba a cada paciente en la coordenada GPS del
--  dispositivo en el momento exacto del registro (RF-06). Eso es
--  correcto para un brigadista que visita casas — pero no refleja cómo
--  opera este distrito: las familias viajan HACIA el puesto de salud,
--  no al revés. En la práctica, eso puso pacientes en la casa o la
--  universidad de quien probaba el sistema, en vez de en sus
--  comunidades reales.
--
--  La corrección: el mapa (RF-07) ahora ubica a cada paciente en la
--  coordenada de su COMUNIDAD DE RESIDENCIA — el dato que ya se elige
--  de un catálogo fijo al registrar al paciente (RF-01), no un GPS
--  circunstancial. Esto además calza mejor con el texto exacto de
--  RF-07: "generar mapas de calor... que representen la concentración
--  de casos de malnutrición POR COMUNIDAD O SECTOR" (Sección 4.2.1) —
--  nunca pidió el punto exacto de cada medición individual.
--
--  FUENTE DE LAS COORDENADAS
--
--  Verificadas contra OpenStreetMap (vía nodos públicos, con GeoNames
--  ID cuando está disponible) — no inventadas. Cada UPDATE cita el
--  nodo de OSM de donde salió, para que puedas verificarlo tú mismo o
--  corregirlo si el nombre no corresponde exactamente al lugar que
--  conoces.
--
--  Quedan SIN coordenada, a propósito, por no encontrar una fuente
--  verificable: Tierra Colorada (parece ser un sector/zona dentro de
--  la cabecera, no un caserío aparte — normalmente pavimentación de
--  "Tierra Colorada Zona 1" aparece en licitaciones municipales, pero
--  no encontré su coordenada exacta), San Martín, Los Ortíz, Bosques
--  de Vista Hermosa I y II, San Francisco I y II, y Chillaní (aldea
--  oficial, pero sin coordenada verificable en las fuentes que
--  consulté). El mapa las omite hasta que tengan coordenada — no
--  aparecen en un lugar incorrecto, simplemente no aparecen todavía.
--  Complétalas con Nominatim (OpenStreetMap) o con la coordenada real
--  del primer registro que se haga ahí en campo.
-- =====================================================================

-- Cabecera municipal — ya tenía coordenada verificada desde 03_seed.sql,
-- se repite aquí para que este script sea la referencia completa.
update comunidad set latitud = 14.683333, longitud = -90.650000
where nombre = 'San Pedro Sac.';

-- OSM node 2626142774 — place=village
update comunidad set latitud = 14.671022, longitud = -90.646138
where nombre = 'Buena Vista';

-- OSM node 13204299413 — place=hamlet
update comunidad set latitud = 14.675697, longitud = -90.611080
where nombre = 'Vista Hermosa';

-- OSM node 12170886446 — place=hamlet
update comunidad set latitud = 14.682969, longitud = -90.624571
where nombre = 'El Aguacate';

-- OSM node 12170895017 — place=hamlet
update comunidad set latitud = 14.680167, longitud = -90.640903
where nombre = 'Laguna Seca';

-- OSM node 12170886445 — place=hamlet
update comunidad set latitud = 14.674801, longitud = -90.621312
where nombre = 'Las Limas';

-- OSM node 13657034193 — place=hamlet. ADVERTENCIA: OpenStreetMap
-- etiqueta este nodo bajo "Municipio de San Juan Sacatepéquez", el
-- municipio vecino, no bajo San Pedro Sacatepéquez. Está muy cerca de
-- El Aguacate (~1.5 km), en la zona límite entre ambos municipios, así
-- que es probable que sea el lugar correcto — pero verifícalo con
-- alguien que conozca la zona antes de confiar en él para una decisión
-- operativa real.
update comunidad set latitud = 14.696639, longitud = -90.623335
where nombre = 'Cruz de Piedra';
