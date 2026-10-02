import { supabase } from './supabase.js'
import { calcularIndicadores } from './oms/zscore.js'
import { clasificar } from './oms/clasificacion.js'
import { conTiempoLimite } from './offline.js'

/**
 * Registra una medición y su indicador nutricional derivado.
 *
 * El cálculo de los puntajes Z se hace en el cliente a propósito: así el
 * personal ve la clasificación en el mismo momento de la consulta, sin
 * esperar respuesta del servidor, y el flujo sigue funcionando cuando la
 * señal es intermitente (Sección 3.1.3). El resultado se persiste en
 * `indicador_nutricional` para no recalcularlo en cada reporte.
 *
 * Las dos inserciones no son una transacción; si la segunda falla, la
 * medición queda sin indicador. Se corrige en la segunda entrega
 * moviendo el cálculo a un trigger de PostgreSQL, que además cerrará la
 * puerta a que un cliente escriba un puntaje Z arbitrario.
 */
export async function guardarMedicion({ paciente, medicion, usuarioId }) {
  const derivados = calcularIndicadores({
    sexo: paciente.sexo,
    fechaNacimiento: paciente.fecha_nacimiento,
    fechaMedicion: medicion.fecha_medicion,
    pesoKg: Number(medicion.peso_kg),
    tallaCm: Number(medicion.talla_cm),
    medidoAcostado: medicion.medido_acostado,
  })

  const dictamen = clasificar(derivados)

  const { data: fila, error: errMedicion } = await conTiempoLimite(supabase
    .from('medicion')
    .insert({
      paciente_id: paciente.id,
      fecha_medicion: medicion.fecha_medicion,
      peso_kg: medicion.peso_kg,
      talla_cm: medicion.talla_cm,
      medido_acostado: medicion.medido_acostado ?? false,
      latitud: medicion.latitud ?? null,
      longitud: medicion.longitud ?? null,
      observaciones: medicion.observaciones || null,
      registrado_por: usuarioId ?? null,
    })
    .select()
    .single())

  if (errMedicion) throw errMedicion

  const { error: errIndicador } = await conTiempoLimite(supabase
    .from('indicador_nutricional')
    .insert({
      medicion_id: fila.id,
      edad_meses: derivados.edadMeses,
      z_peso_edad: derivados.zPesoEdad,
      z_talla_edad: derivados.zTallaEdad,
      z_peso_talla: derivados.zPesoTalla,
      clasificacion: dictamen.clasificacion,
      severidad: dictamen.severidad,
    }))

  if (errIndicador) throw errIndicador

  return { medicion: fila, derivados, dictamen }
}

/** Historial de un paciente, ordenado de la cita más antigua a la más reciente. */
export async function historial(pacienteId) {
  const { data, error } = await conTiempoLimite(supabase
    .from('medicion')
    .select(
      'id, fecha_medicion, peso_kg, talla_cm, medido_acostado, ' +
      'indicador_nutricional(edad_meses, z_peso_edad, z_talla_edad, z_peso_talla, clasificacion, severidad)',
    )
    .eq('paciente_id', pacienteId)
    .order('fecha_medicion', { ascending: true }))

  if (error) throw error

  // Aplanar la relación 1:1 para que el gráfico reciba filas simples
  return (data ?? []).map((m) => ({
    ...m,
    ...(m.indicador_nutricional ?? {}),
  }))
}

/**
 * Todas las mediciones del distrito con su severidad, para los reportes
 * de control (RF-09, Sección 4.3.2). Trae paciente y comunidad en la
 * misma consulta para no hacer una petición por paciente — con RLS por
 * comunidad activo (06_seguridad_por_comunidad.sql), Postgres ya
 * devuelve solo lo que a cada usuario le corresponde ver; no hace falta
 * filtrar nada de esto en el cliente.
 */
export async function todasLasMediciones() {
  const { data, error } = await conTiempoLimite(supabase
    .from('medicion')
    .select(
      'paciente_id, fecha_medicion, ' +
      'paciente(nombre, apellido, comunidad_id, comunidad(nombre)), ' +
      'indicador_nutricional(severidad, clasificacion)',
    )
    .order('fecha_medicion', { ascending: true }))

  if (error) throw error

  return (data ?? []).map((m) => ({
    pacienteId: m.paciente_id,
    fecha: m.fecha_medicion,
    paciente: m.paciente ? `${m.paciente.nombre} ${m.paciente.apellido}` : 'Paciente',
    comunidad: m.paciente?.comunidad?.nombre ?? 'Sin comunidad',
    severidad: m.indicador_nutricional?.severidad ?? 0,
    clasificacion: m.indicador_nutricional?.clasificacion ?? '',
  }))
}

/** Registra en la bitácora de reportes que se generó una vista de control (RF-09). */
export async function registrarReporte(tipo, parametros, usuarioId) {
  const { error } = await supabase
    .from('reporte')
    .insert({ tipo, parametros: parametros ?? {}, generado_por: usuarioId ?? null })
  if (error) console.warn('No se pudo registrar el reporte en la bitácora:', error.message)
}

/**
 * Total de pacientes dados de alta en el sistema (RF-01), sin importar si
 * ya tienen una medición registrada. Es el numerador del indicador de
 * digitalización (Sección 1.2.3): cuántos quedaron en el sistema frente a
 * los que de verdad se atendieron en el periodo (ese segundo número no lo
 * tiene el sistema — viene del SIGSA-2 físico — por eso se captura a mano).
 */
export async function totalPacientesRegistrados() {
  const { count, error } = await conTiempoLimite(supabase
    .from('paciente')
    .select('id', { count: 'exact', head: true }))
  if (error) throw error
  return count ?? 0
}

/**
 * Guarda una medición del indicador de digitalización (RF-09, Sección
 * 4.3.2): qué porcentaje de los pacientes atendidos en un periodo quedó
 * digitalizado en el sistema. El "total atendidos" no existe en ninguna
 * tabla — es el dato del SIGSA-2 en papel, así que lo captura a mano quien
 * genera el reporte. Se guarda como una fila más en `reporte` (igual que
 * cualquier otro reporte de control), con el cálculo ya resuelto en
 * `parametros`, para que el histórico no cambie si después se registran
 * más pacientes.
 */
export async function guardarIndicadorDigitalizacion({ periodo, totalAtendidos, registrados }, usuarioId) {
  const porcentaje = totalAtendidos > 0 ? Math.round((registrados / totalAtendidos) * 100) : 0
  await registrarReporte(
    'registros_digitalizados',
    { periodo, total_atendidos: totalAtendidos, registrados, porcentaje },
    usuarioId,
  )
  return porcentaje
}

/** Histórico de mediciones del indicador de digitalización, más reciente primero. */
export async function historialDigitalizacion() {
  const { data, error } = await conTiempoLimite(supabase
    .from('reporte')
    .select('id, parametros, generado_en, usuario:generado_por(nombre)')
    .eq('tipo', 'registros_digitalizados')
    .order('generado_en', { ascending: false })
    .limit(12))
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    generadoEn: r.generado_en,
    generadoPor: r.usuario?.nombre ?? null,
    ...r.parametros,
  }))
}

/**
 * Planes alimentarios de un paciente (RF-10), del más reciente al más
 * antiguo. La tabla `plan_alimentario` existe desde el primer avance
 * (01_schema.sql); `macronutrientes` y `menu_sugerido` se agregaron en
 * 10_plan_alimentario_estructura.sql para el generador automático — un
 * plan creado antes de esa migración simplemente trae ambas en null.
 */
export async function planesDePaciente(pacienteId) {
  const { data, error } = await conTiempoLimite(supabase
    .from('plan_alimentario')
    .select(
      'id, nombre, descripcion, costo_diario, fecha_inicio, fecha_fin, ' +
      'creado_en, macronutrientes, menu_sugerido, usuario(nombre)',
    )
    .eq('paciente_id', pacienteId)
    .order('fecha_inicio', { ascending: false }))

  if (error) throw error
  return (data ?? []).map((p) => ({ ...p, sugerencia: p.menu_sugerido ?? null }))
}

/** Asigna un nuevo plan alimentario a un paciente. */
export async function asignarPlan({ pacienteId, plan, usuarioId }) {
  const { data, error } = await conTiempoLimite(supabase
    .from('plan_alimentario')
    .insert({
      paciente_id: pacienteId,
      nombre: plan.nombre,
      descripcion: plan.descripcion || null,
      costo_diario: plan.costo_diario === '' ? null : Number(plan.costo_diario),
      fecha_inicio: plan.fecha_inicio,
      fecha_fin: plan.fecha_fin || null,
      macronutrientes: plan.macronutrientes?.length ? plan.macronutrientes : null,
      menu_sugerido: plan.sugerencia ?? null,
      asignado_por: usuarioId ?? null,
    })
    .select()
    .single())

  if (error) throw error
  return { ...data, sugerencia: data.menu_sugerido ?? null }
}

/** Marca un plan como finalizado hoy, sin borrar su historial. */
export async function finalizarPlan(planId) {
  const { error } = await conTiempoLimite(supabase
    .from('plan_alimentario')
    .update({ fecha_fin: new Date().toISOString().slice(0, 10) })
    .eq('id', planId))
  if (error) throw error
}
