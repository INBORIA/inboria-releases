import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const userId = 'd771a44f-3a6f-49a6-ae16-5007652be97f';

const { data: prof } = await supa.from('profiles').select('emails_used,ai_credits_used').eq('id', userId).single();
console.log('profile counters:', prof);

const { data: events } = await supa.from('usage_events').select('event_type,credits,occurred_at,metadata')
  .eq('user_id', userId).order('occurred_at', { ascending: false }).limit(15);
console.log('recent usage_events:');
for (const e of events||[]) console.log(' ', e.occurred_at, e.event_type, '+', e.credits, JSON.stringify(e.metadata));
