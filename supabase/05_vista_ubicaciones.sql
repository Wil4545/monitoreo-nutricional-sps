-- =====================================================================
--  Actualización — Coordenadas para el mapa (RF-06 / RF-07)
--
--  Ejecutar UNA VEZ, después de 01 a 04. La vista v_paciente_estado ya
--  existe; esto solo le agrega dos columnas (latitud, longitud de la
--  última medición).
--
--  IMPORTANTE: CREATE OR REPLACE VIEW exige que las columnas ya
--  existentes conserven su posición — las columnas nuevas deben ir
--  siempre AL FINAL de la lista, nunca insertadas en medio. Por eso
--  latitud/longitud van después de `severidad`, y no junto a
--  `talla_cm` como tendría más sentido de forma natural.
-- =====================================================================

create or replace view v_paciente_estado as
select distinct on (p.id)
  p.id, p.codigo, p.nombre, p.apellido, p.sexo, p.fecha_nacimiento,
  c.nombre  as comunidad,
  m.fecha_medicion, m.peso_kg, m.talla_cm,
  i.z_peso_edad, i.z_talla_edad, i.z_peso_talla,
  i.clasificacion, i.severidad,
  m.latitud, m.longitud
from paciente p
join comunidad c on c.id = p.comunidad_id
left join medicion m on m.paciente_id = p.id
left join indicador_nutricional i on i.medicion_id = m.id
order by p.id, m.fecha_medicion desc nulls last;
