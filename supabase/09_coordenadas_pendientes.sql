-- =====================================================================
--  Actualización — Coordenadas de las últimas 6 comunidades
--
--  Ejecutar UNA VEZ, después de 08_coordenadas_comunidades.sql. Completa
--  las 6 comunidades que quedaron sin coordenada verificable en ese
--  script (Tierra Colorada, San Martín, Los Ortíz, Bosques de Vista
--  Hermosa I y II, San Francisco I y II, Chillaní).
--
--  FUENTE DE LAS COORDENADAS
--
--  Provistas directamente por el usuario (Wilson), copiadas desde la
--  app de mapas de su teléfono como "Geo URL" (formato
--  geo:lat,lon?z=nivel_zoom). Se usa el par lat/lon tal cual; el
--  parámetro z (nivel de zoom del mapa al copiar el enlace) no aporta
--  información geográfica y se descarta.
--
--  Con este script, las 13 comunidades del municipio quedan con
--  coordenada — no debería quedar ninguna pendiente para el mapa
--  (RF-06/RF-07).
-- =====================================================================

-- geo:14.690137,-90.646563?z=19
update comunidad set latitud = 14.690137, longitud = -90.646563
where nombre = 'Tierra Colorada';

-- geo:14.681868,-90.614430?z=19
update comunidad set latitud = 14.681868, longitud = -90.614430
where nombre = 'San Martín';

-- geo:14.666158,-90.643800?z=18
update comunidad set latitud = 14.666158, longitud = -90.643800
where nombre = 'Los Ortíz';

-- geo:14.684071,-90.609747?z=19
update comunidad set latitud = 14.684071, longitud = -90.609747
where nombre = 'Bosques de Vista Hermosa I y II';

-- geo:14.675645,-90.614473?z=18
update comunidad set latitud = 14.675645, longitud = -90.614473
where nombre = 'San Francisco I y II';

-- geo:14.71729,-90.53578?z=16
update comunidad set latitud = 14.71729, longitud = -90.53578
where nombre = 'Chillaní';

-- Verificación: debería devolver 0 filas (ninguna comunidad sin coordenada).
select nombre from comunidad where latitud is null or longitud is null;
