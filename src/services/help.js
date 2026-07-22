import { supabase } from '../lib/supabase';

/* Real Help & Support — articles live in the database, everyone can
   read them, only the owner can write them (RLS-gated), edited straight
   from Moments Studio. No hardcoded FAQ baked into the app bundle. */

export async function fetchHelpArticles() {
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .order('category', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createHelpArticle({ category, title, body, icon, position }) {
  const { data, error } = await supabase
    .from('help_articles')
    .insert({ category: category || 'General', title, body, icon: icon || 'help-circle-outline', position: position || 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHelpArticle(id, patch) {
  const { error } = await supabase
    .from('help_articles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteHelpArticle(id) {
  const { error } = await supabase.from('help_articles').delete().eq('id', id);
  if (error) throw error;
}
