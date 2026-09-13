
import { stressTestAll } from '../src/lib/smartOptimizer';
const res = stressTestAll();
let fail = 0;
for (const r of res) {
  console.log(`${r.type} ${r.profile}: allOk=${r.allOk} iter=${r.iterations}`);
  if (!r.allOk) fail++;
}
if (fail) {
  console.error(`FAIL: ${fail} profiles did not reach all green`);
  process.exit(1);
} else {
  console.log(`ALL SMART STRESS PASS — ${res.length} profiles`);
}


