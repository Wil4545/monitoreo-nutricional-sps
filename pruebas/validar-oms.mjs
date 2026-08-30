import fs from 'fs'
import tablas from '../src/lib/oms/lms.js'
import { calcularIndicadores } from '../src/lib/oms/zscore.js'
import { clasificar } from '../src/lib/oms/clasificacion.js'

const ref = JSON.parse(fs.readFileSync(new URL('./referencia-oms-sd.json', import.meta.url), 'utf8'))
const DE = { SD3neg:-3, SD2neg:-2, SD1neg:-1, SD0:0, SD1:1, SD2:2, SD3:3 }
const valorEnDE = (L,M,S,de) => L===0 ? M*Math.exp(S*de) : M*Math.pow(1+L*S*de, 1/L)

// ── Validación 1 ────────────────────────────────────────────────────────
// Reconstruir cada curva SD desde L,M,S y comparar con la tabla publicada
// de la OMS, fila por fila. 728 filas × 7 curvas = 5,096 comparaciones.
let comparadas = 0, discrepancias = []
for (const ind of Object.keys(ref)) {
  for (const sexo of ['M','F']) {
    for (const [clave, sds] of Object.entries(ref[ind][sexo])) {
      const lms = tablas[ind][sexo][clave]
      if (!lms) { discrepancias.push(`falta LMS ${ind}/${sexo}/${clave}`); continue }
      const [L,M,S] = lms
      for (const [col, de] of Object.entries(DE)) {
        const calc = valorEnDE(L,M,S,de)
        const pub = sds[col]
        const dec = (ind === 'te') ? 1 : 1
        comparadas++
        if (Math.abs(Number(calc.toFixed(dec)) - pub) > 0.051)
          discrepancias.push(`${ind}/${sexo}/${clave}/${col}: calc ${calc.toFixed(3)} vs publicado ${pub}`)
      }
    }
  }
}
console.log(`Curvas SD reconstruidas: ${comparadas} comparaciones`)
console.log(discrepancias.length === 0
  ? '  ✓ todas coinciden con las tablas oficiales de la OMS'
  : `  ✗ ${discrepancias.length} discrepancias:\n   ` + discrepancias.slice(0,8).join('\n   '))

// ── Validación 2 ────────────────────────────────────────────────────────
// Un niño situado exactamente sobre una curva SD debe devolver ese Z.
const nac = '2024-01-01'
const fechaEdad = (m) => { const d=new Date(nac); d.setDate(d.getDate()+Math.round(m*30.4375)); return d.toISOString().slice(0,10) }
let pruebas = 0, fallos = 0
for (const sexo of ['M','F']) {
  for (const mes of [0, 6, 12, 23, 24, 36, 48, 60]) {
    const [Lp,Mp,Sp] = tablas.pe[sexo][mes.toFixed(1)]
    const [Lt,Mt,St] = tablas.te[sexo][mes.toFixed(1)]
    for (const de of [-3,-2,-1,0,1,2]) {
      const peso  = valorEnDE(Lp,Mp,Sp,de)
      const talla = valorEnDE(Lt,Mt,St,de)
      const r = calcularIndicadores({ sexo, fechaNacimiento:nac, fechaMedicion:fechaEdad(mes), pesoKg:peso, tallaCm:talla })
      pruebas += 2
      if (Math.abs(r.zPesoEdad - de) > 0.02) { fallos++; console.log(`  ✗ P/E ${sexo} ${mes}m DE${de} → ${r.zPesoEdad}`) }
      if (Math.abs(r.zTallaEdad - de) > 0.02) { fallos++; console.log(`  ✗ T/E ${sexo} ${mes}m DE${de} → ${r.zTallaEdad}`) }
    }
  }
}
console.log(`\nIda y vuelta sobre curvas conocidas: ${pruebas} pruebas, ${fallos} fallos`)

// ── Validación 3: casos clínicos ────────────────────────────────────────
console.log('\nCasos clínicos:')
const casos = [
  ['Niña 18m, crecimiento normal',        { sexo:'F', fechaMedicion:fechaEdad(18), pesoKg:10.2, tallaCm:80.7 }],
  ['Niño 24m, emaciación severa',         { sexo:'M', fechaMedicion:fechaEdad(24), pesoKg:6.5,  tallaCm:78.0 }],
  ['Niño 36m, talla baja, peso adecuado', { sexo:'M', fechaMedicion:fechaEdad(36), pesoKg:12.0, tallaCm:85.0 }],
  ['Niña 12m, sobrepeso',                 { sexo:'F', fechaMedicion:fechaEdad(12), pesoKg:12.5, tallaCm:74.0 }],
]
for (const [desc, args] of casos) {
  const r = calcularIndicadores({ fechaNacimiento:nac, ...args })
  const c = clasificar(r)
  console.log(`  ${desc}`)
  console.log(`     P/E ${String(r.zPesoEdad).padStart(6)}  T/E ${String(r.zTallaEdad).padStart(6)}  P/T ${String(r.zPesoTalla).padStart(6)}  →  ${c.clasificacion} [sev ${c.severidad}]`)
}

// ── Validación 4: bordes ────────────────────────────────────────────────
const fuera = calcularIndicadores({ sexo:'M', fechaNacimiento:nac, fechaMedicion:fechaEdad(70), pesoKg:20, tallaCm:115 })
console.log(`\nEdad fuera de rango (70m) reporta: ${JSON.stringify(fuera.fueraDeRango)}`)

const ok = discrepancias.length === 0 && fallos === 0
console.log(`\n${ok ? '✓ VALIDACIÓN COMPLETA SUPERADA' : '✗ REVISAR'}`)
