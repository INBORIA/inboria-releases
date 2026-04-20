import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const userId = 'd771a44f-3a6f-49a6-ae16-5007652be97f';
const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
const ms = monthStart.toISOString();
console.log('monthStart:', ms);

const { count: emailsCount, error: e1 } = await supa
  .from('emails').select('id', { count: 'exact', head: true })
  .eq('user_id', userId).gte('created_at', ms);
if (e1) { console.error('emails count err:', e1); process.exit(1); }

const { data: events, error: e2 } = await supa
  .from('usage_events').select('credits,event_type,occurred_at')
  .eq('user_id', userId).gte('occurred_at', ms);
if (e2) { console.error('events err:', e2); process.exit(1); }

const aiCreditsUsed = (events||[]).filter(e=>e.event_type!=='auto_triage').reduce((s,e)=>s+(e.credits||0),0);
const byType = {};
for (const e of events||[]) byType[e.event_type] = (byType[e.event_type]||0)+(e.credits||0);

console.log('emails this month:', emailsCount);
console.log('events this month:', (events||[]).length, 'breakdown:', byType);
console.log('-> emails_used should be:', emailsCount);
console.log('-> ai_credits_used should be (excl auto_triage):', aiCreditsUsed);
console.log('-> TOTAL:', (emailsCount||0) + aiCreditsUsed);

const { error: upErr } = await supa.from('profiles').update({
  emails_used: emailsCount||0,
  ai_credits_used: aiCreditsUsed,
  quota_period_start: ms,
}).eq('id', userId);
if (upErr) { console.error('update err:', upErr); process.exit(1); }
console.log('OK profile updated');
