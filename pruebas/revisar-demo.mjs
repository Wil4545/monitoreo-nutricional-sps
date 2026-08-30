import { pacientesDemo } from '../src/lib/demo.js'
for (const p of pacientesDemo) {
  const m = p.mediciones
  const dz = (k) => (m[m.length-1][k] - m[0][k]).toFixed(2)
  const meses = (m[m.length-1].edad_meses - m[0].edad_meses).toFixed(1)
  console.log(`${p.nombre} — ${p.nota}`)
  console.log(`   T/E ${m[0].z_talla_edad} → ${m[m.length-1].z_talla_edad}  (Δ ${dz('z_talla_edad')} en ${meses} m, pendiente ${(dz('z_talla_edad')/meses).toFixed(3)} Z/mes)`)
  console.log(`   P/T ${m[0].z_peso_talla} → ${m[m.length-1].z_peso_talla}  (pendiente ${(dz('z_peso_talla')/meses).toFixed(3)} Z/mes)`)
  console.log(`   último dictamen: ${m[m.length-1].clasificacion}\n`)
}
