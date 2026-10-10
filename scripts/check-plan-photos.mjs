/* ─── REAL PHOTOS ON PLANS, NEVER STOCK ───────────────────────────────
       node scripts/check-plan-photos.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.indexOf('PLANS · REAL PHOTOS, NEVER STOCK'));
const photo = read('src/components/green/PlanPhoto.js');
const form = read('src/components/green/StartForm.js');
const sheet = read('src/components/green/GreenSheet.js');
const admin = read('src/components/AdminPanel.js');
is('only a file uploaded to our storage, in the uploader\'s own folder', /p_url not like 'https:\/\/dvddiyztpyyuultndzso\.supabase\.co\/storage\/v1\/object\/public\/media\/' \|\| me::text \|\| '\/%'/.test(part), true);
is('only the host sets it', /where id = p_id and host_id = me/.test(part), true);
is('last time: earlier weeks of the same plan, and image posts within 300 m', /o\.weekly_id = g\.weekly_id/.test(part) && /km_between\(g\.lat, g\.lng, p\.lat, p\.lng\) <= 0\.3/.test(part) && /mp4\|webm\|mov/.test(part), true);
is('the list carries both', /g\.photo_url, public\.green_past_photos\(g\) as past_photos/.test(part), true);
is('the host or the owner can take one down', /green_photo_remove/.test(part) && /is_app_owner\(\)/.test(part.slice(part.indexOf('green_photo_remove'))), true);
is('no stock pictures anywhere: a plan without a photo keeps its drawn look', /LinearGradient colors=\{\[look\.from, look\.to\]\}/.test(photo) && !/unsplash|pexels|pixabay|stock/i.test(photo + form), true);
is('only https ever reaches an image', /\/\^https:\\\/\\\/\/i\.test\(u\)/.test(photo), true);
is('the photo is optional in the form', /sf_photo_sub/.test(form) && !/required/.test(form.slice(form.indexOf('pickPhoto'))), true);
is('a failed upload never loses the plan', /the plan stands either way/.test(sheet), true);
is('a photo can be reported, and the owner sees it before taking it down', /contentType="plan_photo"/.test(sheet) && /r\.content_type === 'plan_photo'/.test(admin) && /removeGatheringPhoto\(gid, url/.test(admin), true);
if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nPlans show real photos — the host\'s, or from last time — and nothing pretends to be the place.');
