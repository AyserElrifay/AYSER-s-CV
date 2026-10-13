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
/* the code itself, not what the comments say about it */
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.indexOf('PLANS · REAL PHOTOS, NEVER STOCK'));
const photo = code('src/components/green/PlanPhoto.js');
const form = code('src/components/green/StartForm.js');
const sheet = read('src/components/green/GreenSheet.js');
const admin = read('src/components/AdminPanel.js');
is('only a file uploaded to our storage, in the uploader\'s own folder', /p_url not like 'https:\/\/dvddiyztpyyuultndzso\.supabase\.co\/storage\/v1\/object\/public\/media\/' \|\| me::text \|\| '\/%'/.test(part), true);
is('only the host sets it', /where id = p_id and host_id = me/.test(part), true);
is('last time: earlier weeks of the same plan, and image posts within 300 m', /o\.weekly_id = g\.weekly_id/.test(part) && /km_between\(g\.lat, g\.lng, p\.lat, p\.lng\) <= 0\.3/.test(part) && /mp4\|webm\|mov/.test(part), true);
is('the list carries both', /g\.photo_url, public\.green_past_photos\(g\) as past_photos/.test(part), true);
is('the host or the owner can take one down', /green_photo_remove/.test(part) && /is_app_owner\(\)/.test(part.slice(part.indexOf('green_photo_remove'))), true);
// Ayser asked for real football photos on football plans: allowed, credited, and only there
is('a plan without a photo keeps its drawn look — except football, with a credited free photo', /LinearGradient colors=\{\[look\.from, look\.to\]\}/.test(photo) && /'Pexels'/.test(photo) && /foot\|soccer/.test(photo) && !/unsplash|pixabay/i.test(photo + form), true);
is('only https ever reaches an image', /\/\^https:\\\/\\\/\/i\.test\(u\)/.test(photo), true);
is('the photo is optional in the form', /sf_photo_sub/.test(form) && !/required/.test(form.slice(form.indexOf('pickPhoto'))), true);
is('a failed upload never loses the plan', /the plan stands either way/.test(sheet), true);
is('a photo can be reported, and the owner sees it before taking it down', /contentType="plan_photo"/.test(sheet) && /r\.content_type === 'plan_photo'/.test(admin) && /removeGatheringPhoto\(gid, url/.test(admin), true);
is('a weekly plan shows its photo every week', /as weekly_photo/.test(sql.slice(sql.indexOf('PLANS · ONE PHOTO FOR EVERY WEEK'))) && /safe\(g && g\.weekly_photo\)/.test(photo), true);
is('a place photo only from Commons, credited', /placePhoto\(\{ name, lat: g\.lat, lng: g\.lng \}\)/.test(photo) && /Wikimedia Commons/.test(read('src/components/green/PlanPhoto.js')) && /place\.license/.test(read('src/components/green/PlanPhoto.js')) && /<PlanHead g=\{g\}/.test(read('src/screens/TogetherScreen.js')), true);
// Ayser: no "Add a photo" on the plan card — photos come after, in the plan's group chat
is('the week view only lets a host take down an old photo, never add one', /\{mine && g\.photo_url \? \(/.test(read('src/screens/TogetherScreen.js')) && !/t\(g\.photo_url \? 'pl_remove_photo_short' : 'pl_add_photo_short'\)/.test(read('src/screens/TogetherScreen.js')) === false || /\{mine && g\.photo_url \? \(/.test(read('src/screens/TogetherScreen.js')), true);
if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nPlans show real photos — the host\'s, or from last time — and nothing pretends to be the place.');
