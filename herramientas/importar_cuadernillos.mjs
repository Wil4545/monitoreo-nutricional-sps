#!/usr/bin/env node
/**
 * Convierte la transcripción de los cuadernillos (un CSV) en un script
 * SQL listo para pegar en el SQL Editor de Supabase.
 *
 * Uso:
 *   node herramientas/importar_cuadernillos.mjs datos.csv
 *   node herramientas/importar_cuadernillos.mjs datos.csv --inicio 1 --salida salida.sql
 *
 * POR QUÉ UN SCRIPT Y NO SQL ESCRITO A MANO
 *   Los puntajes Z y la clasificación NO se calculan en la base de datos:
 *   los calcula la app en el navegador (src/lib/oms/zscore.js y
 *   clasificacion.js) y guarda el resultado en `indicador_nutricional`.
 *   Si se insertaran solo pacientes y mediciones, el panel, la lista y el
 *   mapa los mostrarían sin estado nutricional. Este script importa
 *   esas mismas funciones, así que lo importado queda idéntico a lo que
 *   habría guardado la app al registrar cada medición a mano.
 *
 * FORMATO DEL CSV (una fila por medición; un paciente con 3 citas ocupa
 * 3 filas con los mismos datos de paciente; un paciente sin mediciones
 * va en una fila con peso/talla/fecha_medicion vacíos):
 *
 *   obligatorias: nombre, apellido, sexo (M/F), fecha_nacimiento
 *                 (AAAA-MM-DD), comunidad (igual que en el catálogo)
 *   opcionales:   tutor_nombre, tutor_telefono, fecha_medicion,
 *                 peso_kg, talla_cm, medido_acostado (si/no),
 *                 observaciones
 *
 * Si no se indica medido_acostado se propone según la edad (acostado
 * antes de 24 meses), igual que el formulario de la app.
 *
 * Los códigos (SPS-AAAA-NNNN) se asignan en orden de aparición desde
 * --inicio (por defecto 1). Si la tabla ya tiene pacientes, usa
 * --inicio = (total actual + 1) para seguir la misma numeración que usa
 * la app.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { calcularIndicadores, edadEnMeses } from '../src/lib/oms/zscore.js'
import { clasificar } from '../src/lib/oms/clasificacion.js'
import { generarCodigo, hoyISO } from '../src/lib/formato.js'

// ---------- argumentos ----------
const args = process.argv.slice(2)
const entrada = args.find((a) => !a.startsWith('--'))
const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 ? args[i + 1] : porDefecto
}
if (!entrada) {
  console.error('Uso: node herramientas/importar_cuadernillos.mjs datos.csv [--inicio N] [--salida archivo.sql]')
  process.exit(1)
}
const inicio = Number(opcion('inicio', '1'))
const salida = opcion('salida', entrada.replace(/\.csv$/i, '') + '.sql')

// ---------- CSV (comillas, comas dentro de comillas, BOM) ----------
function parsearCSV(texto) {
  const filas = []
  let fila = [], campo = '', entreComillas = false
  const t = texto.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') entreComillas = false
      else campo += c
    } else if (c === '"') entreComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.some((x) => x.trim() !== '')) filas.push(fila)
      fila = []
    } else campo += c
  }
  fila.push(campo)
  if (fila.some((x) => x.trim() !== '')) filas.push(fila)
  return filas
}

const [encabezado, ...cuerpo] = parsearCSV(readFileSync(entrada, 'utf8'))
const col = Object.fromEntries(encabezado.map((h, i) => [h.trim().toLowerCase(), i]))
for (const req of ['nombre', 'apellido', 'sexo', 'fecha_nacimiento', 'comunidad']) {
  if (!(req in col)) { console.error(`Falta la columna obligatoria "${req}".`); process.exit(1) }
}
const val = (fila, nombre) => (fila[col[nombre]] ?? '').trim()

// ---------- validación y agrupación ----------
const errores = [], avisos = []
const pacientes = new Map()
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime())
const hoy = hoyISO()

cuerpo.forEach((fila, idx) => {
  const n = idx + 2 // número de línea en el archivo (1 = encabezado)
  const nombre = val(fila, 'nombre'), apellido = val(fila, 'apellido')
  const sexo = val(fila, 'sexo').toUpperCase()
  const nac = val(fila, 'fecha_nacimiento'), comunidad = val(fila, 'comunidad')
  const donde = `Línea ${n} (${nombre} ${apellido})`

  if (!nombre || !apellido) return errores.push(`Línea ${n}: falta nombre o apellido.`)
  if (!['M', 'F'].includes(sexo)) errores.push(`${donde}: sexo debe ser M o F.`)
  if (!esFecha(nac)) errores.push(`${donde}: fecha_nacimiento inválida (usa AAAA-MM-DD).`)
  else if (nac > hoy) errores.push(`${donde}: fecha_nacimiento en el futuro.`)
  if (!comunidad) errores.push(`${donde}: falta la comunidad.`)

  const clave = [nombre, apellido, nac].map((s) => s.toLowerCase()).join('|')
  if (!pacientes.has(clave)) {
    pacientes.set(clave, {
      id: randomUUID(), nombre, apellido, sexo, nac, comunidad,
      tutor_nombre: val(fila, 'tutor_nombre'), tutor_telefono: val(fila, 'tutor_telefono'),
      mediciones: [],
    })
  } else if (pacientes.get(clave).comunidad !== comunidad) {
    avisos.push(`${donde}: la comunidad difiere de otra fila del mismo paciente; se usa la primera.`)
  }

  const fechaMed = val(fila, 'fecha_medicion')
  const peso = val(fila, 'peso_kg').replace(',', '.'), talla = val(fila, 'talla_cm').replace(',', '.')
  if (!fechaMed && !peso && !talla) return // paciente sin medición
  if (!esFecha(fechaMed)) return errores.push(`${donde}: fecha_medicion inválida o vacía.`)
  if (fechaMed > hoy) errores.push(`${donde}: fecha_medicion en el futuro.`)
  if (esFecha(nac) && fechaMed < nac) errores.push(`${donde}: la medición es anterior al nacimiento.`)
  const p = Number(peso), t = Number(talla)
  if (!(p >= 0.5 && p <= 60)) errores.push(`${donde}: peso_kg fuera de 0.5–60 ("${peso}").`)
  if (!(t >= 30 && t <= 150)) errores.push(`${donde}: talla_cm fuera de 30–150 ("${talla}").`)

  const ac = val(fila, 'medido_acostado').toLowerCase()
  let acostado = null
  if (['si', 'sí', 's', '1', 'true'].includes(ac)) acostado = true
  else if (['no', 'n', '0', 'false'].includes(ac)) acostado = false
  pacientes.get(clave).mediciones.push({
    id: randomUUID(), fecha: fechaMed, peso: p, talla: t, acostado,
    observaciones: val(fila, 'observaciones'), linea: n,
  })
})

if (errores.length) {
  console.error(`\nNo se generó el SQL: ${errores.length} problema(s) en el CSV:\n`)
  errores.forEach((e) => console.error('  · ' + e))
  process.exit(1)
}

// ---------- SQL ----------
const q = (s) => (s === '' || s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const num = (x) => (x == null || !Number.isFinite(x) ? 'null' : String(x))

const lista = [...pacientes.values()]
const comunidades = [...new Set(lista.map((p) => p.comunidad))]
const sqlPac = [], sqlMed = [], sqlInd = []
const resumen = { 0: 0, 1: 0, 2: 0, 3: 0 }

lista.forEach((p, i) => {
  const codigo = generarCodigo(inicio + i)
  sqlPac.push(
    `  (${q(p.id)}, ${q(codigo)}, ${q(p.nombre)}, ${q(p.apellido)}, ${q(p.nac)}, ${q(p.sexo)}, ` +
    `(select id from comunidad where nombre = ${q(p.comunidad)}), ${q(p.tutor_nombre)}, ${q(p.tutor_telefono)})`,
  )
  p.mediciones.sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const m of p.mediciones) {
    const meses = edadEnMeses(p.nac, m.fecha)
    const acostado = m.acostado ?? meses < 24
    const d = calcularIndicadores({
      sexo: p.sexo, fechaNacimiento: p.nac, fechaMedicion: m.fecha,
      pesoKg: m.peso, tallaCm: m.talla, medidoAcostado: acostado,
    })
    const c = clasificar(d)
    if (d.fueraDeRango.length) {
      avisos.push(`${codigo} ${p.nombre} ${p.apellido}, línea ${m.linea}: fuera del rango OMS (${d.fueraDeRango.join(', ')}); puntaje Z vacío en esos indicadores.`)
    }
    sqlMed.push(
      `  (${q(m.id)}, ${q(p.id)}, ${q(m.fecha)}, ${m.peso}, ${m.talla}, ${acostado}, ${q(m.observaciones)})`,
    )
    sqlInd.push(
      `  (${q(m.id)}, ${num(d.edadMeses)}, ${num(d.zPesoEdad)}, ${num(d.zTallaEdad)}, ${num(d.zPesoTalla)}, ${q(c.clasificacion)}, ${c.severidad})`,
    )
  }
})
// Resumen: severidad vigente (la última medición de cada paciente)
for (const p of lista) {
  const ult = p.mediciones.at(-1)
  if (!ult) continue
  const d = calcularIndicadores({ sexo: p.sexo, fechaNacimiento: p.nac, fechaMedicion: ult.fecha, pesoKg: ult.peso, tallaCm: ult.talla, medidoAcostado: ult.acostado ?? edadEnMeses(p.nac, ult.fecha) < 24 })
  resumen[clasificar(d).severidad]++
}

const sql = `-- Generado por herramientas/importar_cuadernillos.mjs a partir de ${entrada}
-- ${lista.length} pacientes, ${sqlMed.length} mediciones. Códigos desde ${generarCodigo(inicio)}.
-- Corre todo junto en el SQL Editor: es una transacción, o entra todo o no entra nada.

begin;

-- Verifica que cada comunidad exista en el catálogo (nombres exactos).
do $$
declare faltan text;
begin
  select string_agg(n, ', ') into faltan
  from unnest(array[${comunidades.map(q).join(', ')}]) as n
  where not exists (select 1 from comunidad c where c.nombre = n);
  if faltan is not null then
    raise exception 'Comunidades que no existen en el catálogo: %', faltan;
  end if;
end $$;

insert into paciente
  (id, codigo, nombre, apellido, fecha_nacimiento, sexo, comunidad_id, tutor_nombre, tutor_telefono)
values
${sqlPac.join(',\n')};
${sqlMed.length ? `
insert into medicion
  (id, paciente_id, fecha_medicion, peso_kg, talla_cm, medido_acostado, observaciones)
values
${sqlMed.join(',\n')};

insert into indicador_nutricional
  (medicion_id, edad_meses, z_peso_edad, z_talla_edad, z_peso_talla, clasificacion, severidad)
values
${sqlInd.join(',\n')};
` : ''}
commit;
`
writeFileSync(salida, sql)

console.log(`\nListo: ${salida}`)
console.log(`  ${lista.length} pacientes · ${sqlMed.length} mediciones · códigos ${generarCodigo(inicio)} a ${generarCodigo(inicio + lista.length - 1)}`)
console.log(`  Estado vigente → normal: ${resumen[0]} · riesgo: ${resumen[1]} · moderada: ${resumen[2]} · severa: ${resumen[3]}`)
if (avisos.length) { console.log(`\nAvisos (${avisos.length}):`); avisos.forEach((a) => console.log('  · ' + a)) }
