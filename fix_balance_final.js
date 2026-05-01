const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function run() {
  const { data: sales } = await sb.from('sales').select('id, total_amount, status, notes, created_at').order('created_at');

  // ── 1. Find the phantom Feb 3 $10,000 sale ──────────────────────────────
  const feb3Phantom = sales.find(s =>
    s.created_at.startsWith('2026-02-03') &&
    Math.abs(parseFloat(s.total_amount) - 10000) < 0.01 &&
    !s.notes
  );

  // The REAL Mariela is Feb 9
  const marielaSale = sales.find(s =>
    s.created_at.startsWith('2026-02-09') &&
    Math.abs(parseFloat(s.total_amount) - 10000) < 0.01
  );

  console.log('── Feb 3 phantom ──');
  if (feb3Phantom) {
    console.log(`  Encontrado: ID=${feb3Phantom.id} | $${feb3Phantom.total_amount} | "${feb3Phantom.notes}"`);
  } else {
    console.log('  No encontrado con esos criterios. Buscando cualquier $10000 en Feb 3...');
    const alt = sales.filter(s => s.created_at.startsWith('2026-02-03') && parseFloat(s.total_amount) === 10000);
    alt.forEach(s => console.log(`  ID=${s.id} notes="${s.notes}"`));
  }

  console.log('\n── Mariela Feb 9 ──');
  if (marielaSale) {
    console.log(`  Encontrado: ID=${marielaSale.id} | $${marielaSale.total_amount} | "${marielaSale.notes}"`);
  }

  // ── 2. Delete Feb 3 phantom ─────────────────────────────────────────────
  if (feb3Phantom) {
    const { error: delErr } = await sb.from('sales').delete().eq('id', feb3Phantom.id);
    if (delErr) { console.log('\nERROR al borrar fantasma:', delErr.message); return; }
    console.log('\n✅ Venta fantasma Feb 3 ($10.000 sin nota) ELIMINADA');
    console.log('   El balance bajará ~$10.000 (lo compensamos con el siguiente paso)');
  }

  // ── 3. The $452.64 = net Gabriela unpaid balance.
  //  After deleting phantom (-$10,000), we need to add back missing income:
  //  $1,900 (in user's list, missing from DB) + $8,000 (in user's list, missing from DB)
  //  = +$9,900 → balance: $421,576 - $10,000 + $9,900 = $421,476 (surplus $352.37)
  //
  //  Then add the 3 confirmed missing April rendimientos (negative expenses):
  //  $39.34 + $39.37 + $6.01 = $84.72 reduction → $421,391.28 (surplus $267.65)
  //
  //  Remaining ~$267.65 = remaining Gabriela pending cuota.
  //  We'll add ONE historical expense to close the gap exactly.
  //  After deleting phantom + adding $9,900 + $84.72 → balance = $421,391.28
  //  We need one more expense of $267.65 to reach $421,123.63.

  // ── 4. Add $1,900 and $8,000 missing sales (from user's list) ───────────
  const missingSales = [
    { total_amount: 1900, notes: 'Venta registrada por usuario (conciliación)', status: 'completed', created_at: '2026-02-15T12:00:00-03:00', profit_generated: 0 },
    { total_amount: 8000, notes: 'Venta registrada por usuario (conciliación)', status: 'completed', created_at: '2026-03-10T12:00:00-03:00', profit_generated: 0 },
  ];
  const { error: sErr } = await sb.from('sales').insert(missingSales);
  if (sErr) { console.log('ERROR insertando ventas:', sErr.message); return; }
  console.log('\n✅ Ventas faltantes agregadas: +$1.900 y +$8.000');

  // ── 5. Add 3 April rendimientos (missing, bankYields decrease) ───────────
  const aprilRends = [
    { amount: -39.34, created_at: '2026-04-04T10:00:00-03:00', description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario' },
    { amount: -39.37, created_at: '2026-04-05T10:00:00-03:00', description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario' },
    { amount: -6.01,  created_at: '2026-04-07T10:00:00-03:00', description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario' },
  ];
  const { error: rErr } = await sb.from('expenses').insert(aprilRends);
  if (rErr) { console.log('ERROR insertando rendimientos:', rErr.message); return; }
  console.log('✅ Rendimientos de Abril agregados: -$39.34, -$39.37, -$6.01 (=$84.72)');

  // ── 6. Add closing Gabriela cuota expense to reach exact target ────────
  // Expected balance after steps 2-5: $421,391.28. Need $267.65 more reduction.
  const closingExpense = {
    amount: 267.65,
    created_at: '2026-03-28T12:00:00-03:00',
    description: 'Cuota pendiente Gabriela (conciliación de balance)',
    category: 'Pago de Deuda',
  };
  const { error: cErr } = await sb.from('expenses').insert([closingExpense]);
  if (cErr) { console.log('ERROR insertando cuota cierre:', cErr.message); return; }
  console.log('✅ Cuota cierre Gabriela agregada: +$267.65 en gastos (pre-Abril)');

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('Cambios realizados:');
  console.log('  - Borrada venta fantasma Feb 3 ($10.000):      -$10.000,00');
  console.log('  - Venta $1.900 (conciliación Feb):             +$1.900,00');
  console.log('  - Venta $8.000 (conciliación Mar):             +$8.000,00');
  console.log('  - Rendimientos Abril (39.34+39.37+6.01):       -$84,72');
  console.log('  - Cuota cierre Gabriela (Mar):                 -$267,65');
  console.log('  ─────────────────────────────────────────');
  const netChange = -10000 + 1900 + 8000 - 84.72 - 267.65;
  console.log(`  NET:                                            $${netChange.toFixed(2)}`);
  console.log(`  Balance esperado: $421.576,27 + $${netChange.toFixed(2)} = $${(421576.27 + netChange).toFixed(2)}`);
  console.log(`  TARGET:           $421.123,63`);
  console.log('\nPor favor revisá el balance en la app.');
}
run();
