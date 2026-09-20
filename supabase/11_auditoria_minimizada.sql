-- =====================================================================
--  Actualización — Minimización de datos en la bitácora (RNF-05)
--
--  Ejecutar UNA VEZ, después de 10_plan_alimentario_estructura.sql.
--
--  POR QUÉ ESTO IMPORTA
--
--  El trigger de auditoría (fn_auditar, en 01_schema.sql) guardaba en
--  `registro_auditoria.detalle` una copia COMPLETA de la fila afectada
--  (`to_jsonb(old)` / `to_jsonb(new)`). Para `paciente`, eso significa
--  que cada alta o modificación duplicaba, dentro de la bitácora, el
--  nombre completo, la fecha de nacimiento, y el nombre y teléfono del
--  tutor de un menor de cinco años — datos que ya viven en `paciente` y
--  no necesitan una segunda copia en un registro pensado para
--  trazabilidad ("¿quién hizo qué y cuándo?"), no para consulta clínica.
--
--  Esta migración reemplaza la función para que, específicamente en
--  `paciente`, el detalle guardado sea mínimo:
--
--   - El código del paciente (SPS-AAAA-NNNN) en vez del nombre — el
--     mismo identificador pseudónimo que ya se usa en toda la app para
--     referirse al paciente sin repetir su nombre completo.
--   - La comunidad, útil para trazabilidad geográfica sin ser dato
--     identificador de la persona.
--   - En una modificación, la LISTA de columnas que cambiaron (no sus
--     valores) — sirve para saber "se editó el teléfono del tutor" sin
--     volver a guardar el teléfono.
--
--  `medicion` no se toca: sus columnas (peso, talla, fecha, ubicación)
--  son datos clínicos sin nombre ni identidad asociada directamente en
--  esa fila (solo un `paciente_id`, un UUID), así que conservarlas
--  completas en la bitácora no repite ningún dato personal.
--
--  Esta migración solo cambia el comportamiento HACIA ADELANTE: no
--  reescribe ni borra el detalle ya guardado en filas anteriores de
--  `registro_auditoria` (eso requeriría una decisión aparte sobre
--  retención de datos históricos, fuera del alcance de esta entrega).
-- =====================================================================

create or replace function fn_auditar()
returns trigger language plpgsql security definer as $$
declare
  det     jsonb;
  cambios text[];
begin
  if tg_table_name = 'paciente' then
    if tg_op = 'UPDATE' then
      select array_agg(o.key order by o.key)
      into cambios
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n on n.key = o.key
      where n.value is distinct from o.value;

      det := jsonb_build_object(
        'codigo', new.codigo,
        'comunidad_id', new.comunidad_id,
        'campos_modificados', to_jsonb(coalesce(cambios, array[]::text[]))
      );
    else
      det := jsonb_build_object(
        'codigo', coalesce(new.codigo, old.codigo),
        'comunidad_id', coalesce(new.comunidad_id, old.comunidad_id)
      );
    end if;
  else
    det := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  end if;

  insert into registro_auditoria (usuario_id, entidad, entidad_id, accion, detalle)
  values (
    auth.uid(),
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'modificacion' else 'baja' end,
    det
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- No hace falta recrear los triggers: ya apuntan a fn_auditar() por
-- nombre, así que el CREATE OR REPLACE de arriba es suficiente.
