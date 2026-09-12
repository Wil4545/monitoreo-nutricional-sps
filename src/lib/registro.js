import { supabase } from './supabase.js'
import { calcularIndicadores } from './oms/zscore.js'
import { clasificar } from './oms/clasificacion.js'

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

  const { data: fila, error: errMedicion } = await supabase
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
    .single()

  if (errMedicion) throw errMedicion

  const { error: errIndicador } = await supabase
    .from('indicador_nutricional')
    .insert({
      medicion_id: fila.id,
      edad_meses: derivados.edadMeses,
      z_peso_edad: derivados.zPesoEdad,
      z_talla_edad: derivados.zTallaEdad,
      z_peso_talla: derivados.zPesoTalla,
      clasificacion: dictamen.clasificacion,
      severidad: dictamen.severidad,
    })

  if (errIndicador) throw errIndicador

  return { medicion: fila, derivados, dictamen }
}

/** Historial de un paciente, ordenado de la cita más antigua a la más reciente. */
export async function historial(pacienteId) {
  const { data, error } = await supabase
    .from('medicion')
    .select(
      'id, fecha_medicion, peso_kg, talla_cm, medido_acostado, ' +
      'indicador_nutricional(edad_meses, z_peso_edad, z_talla_edad, z_peso_talla, clasificacion, severidad)',
    )
    .eq('paciente_id', pacienteId)
    .order('fecha_medicion', { ascending: true })

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
  const { data, error } = await supabase
    .from('medicion')
    .select(
      'paciente_id, fecha_medicion, ' +
      'paciente(nombre, apellido, comunidad_id, comunidad(nombre)), ' +
      'indicador_nutricional(severidad, clasificacion)',
    )
    .order('fecha_medicion', { ascending: true })

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
