-- =====================================================================
--  Actualización — Estructura para planes alimentarios automatizados
--
--  Ejecutar UNA VEZ, después de 09_coordenadas_pendientes.sql.
--
--  RF-10 pasó de un formulario de texto libre a un generador: el
--  personal marca los macronutrientes que el paciente necesita reforzar
--  (Energía, Proteína, Hierro, Zinc, Vitamina A, Calcio) y el sistema
--  propone un listado de alimentos accesibles localmente y un menú-guía
--  de 5 tiempos de comida (ver `src/lib/nutricion.js`). Esta migración
--  agrega las dos columnas donde se guarda esa selección, para que el
--  PDF se pueda regenerar más adelante sin volver a calcular nada:
--
--   - macronutrientes: los ids de macronutrientes elegidos (ej.
--     {energia,proteina,hierro}).
--   - menu_sugerido: el menú-guía generado en el momento de crear el
--     plan, como JSON — así el plan queda "congelado" tal como se
--     presentó al tutor, aunque el catálogo de alimentos cambie después.
--
--  No se migran los planes creados antes de esta actualización: quedan
--  con estas columnas en NULL y se siguen viendo con su nombre y
--  descripción de siempre, solo sin generador ni PDF con menú (pueden
--  editarse creando un plan nuevo si se quiere pasarlos al formato
--  automatizado).
-- =====================================================================

alter table plan_alimentario
  add column if not exists macronutrientes text[],
  add column if not exists menu_sugerido jsonb;
