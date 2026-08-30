/**
 * Datos de demostración.
 *
 * Sirven para mostrar el sistema sin conexión a Supabase, por ejemplo en
 * una revisión con el asesor o en el centro de salud antes de crear las
 * cuentas. No son datos reales de ningún paciente: los pesos y tallas se
 * eligieron para ilustrar tres trayectorias clínicas distintas, y los
 * puntajes Z se calculan con el mismo motor que usa el sistema en
 * producción, no están escritos a mano.
 */

import { calcularIndicadores } from './oms/zscore.js'
import { clasificar } from './oms/clasificacion.js'

function citasDe(paciente, citas) {
  return citas.map(([fecha, peso, talla], i) => {
    const acostado = paciente.mideAcostado ?? false
    const z = calcularIndicadores({
      sexo: paciente.sexo,
      fechaNacimiento: paciente.fecha_nacimiento,
      fechaMedicion: fecha,
      pesoKg: peso,
      tallaCm: talla,
      medidoAcostado: acostado,
    })
    const d = clasificar(z)
    return {
      id: `${paciente.id}-m${i}`,
      fecha_medicion: fecha,
      peso_kg: peso,
      talla_cm: talla,
      medido_acostado: acostado,
      edad_meses: z.edadMeses,
      z_peso_edad: z.zPesoEdad,
      z_talla_edad: z.zTallaEdad,
      z_peso_talla: z.zPesoTalla,
      clasificacion: d.clasificacion,
      severidad: d.severidad,
    }
  })
}

const definiciones = [
  {
    id: 'demo-1',
    codigo: 'SPS-2026-0001',
    nombre: 'Ana Lucía',
    apellido: 'Chávez Morales',
    sexo: 'F',
    fecha_nacimiento: '2024-02-10',
    comunidad: { nombre: 'Vista Hermosa' },
    tutor_nombre: 'Rosa Morales',
    nota: 'Responde al plan alimentario: la tendencia sube.',
    mideAcostado: true,
    citas: [
      ['2025-04-15', 7.1, 71.0],
      ['2025-06-17', 7.9, 73.6],
      ['2025-08-19', 8.8, 76.2],
      ['2025-10-21', 9.7, 78.8],
      ['2025-12-16', 10.6, 81.4],
    ],
  },
  {
    id: 'demo-2',
    codigo: 'SPS-2026-0002',
    nombre: 'Diego Alejandro',
    apellido: 'Pérez Sicán',
    sexo: 'M',
    fecha_nacimiento: '2023-05-22',
    comunidad: { nombre: 'Tierra Colorada' },
    tutor_nombre: 'Manuel Pérez',
    nota: 'Talla estancada pese al peso: patrón de desnutrición crónica.',
    citas: [
      ['2025-03-10', 10.2, 79.0],
      ['2025-05-12', 10.5, 80.1],
      ['2025-07-14', 10.9, 81.0],
      ['2025-09-15', 11.2, 81.9],
      ['2025-11-17', 11.6, 82.7],
    ],
  },
  {
    id: 'demo-3',
    codigo: 'SPS-2026-0003',
    nombre: 'Marta Elena',
    apellido: 'Xocop Tuy',
    sexo: 'F',
    fecha_nacimiento: '2023-11-03',
    comunidad: { nombre: 'Chillaní' },
    tutor_nombre: 'Juana Tuy',
    nota: 'Deterioro sostenido: caso para visita domiciliaria.',
    citas: [
      ['2025-02-20', 9.4, 76.0],
      ['2025-04-22', 9.5, 77.1],
      ['2025-06-24', 9.4, 78.0],
      ['2025-08-26', 9.3, 78.8],
      ['2025-10-28', 9.2, 79.4],
    ],
  },
]

export const pacientesDemo = definiciones.map((d) => {
  const { citas, mideAcostado, ...paciente } = d
  return { ...paciente, mediciones: citasDe(d, citas) }
})
