/**
 * websiteService.ts
 *
 * CRUD for public-facing website content (website_content table).
 * Each "section" is a single JSONB row, freely shapeable per section.
 */

import { supabase } from './supabase';

export type WebsiteSection =
  | 'hero'
  | 'about'
  | 'contact'
  | 'how_it_works'
  | 'gallery'
  | 'seo';

export interface WebsiteContent {
  section: WebsiteSection;
  content: Record<string, any>;
  updated_at: string;
}

/** Fetch one section. Returns null if not found. */
export async function getWebsiteSection(section: WebsiteSection): Promise<Record<string, any> | null> {
  const { data, error } = await supabase
    .from('website_content')
    .select('content')
    .eq('section', section)
    .maybeSingle();
  if (error) throw error;
  return data?.content ?? null;
}

/** Fetch ALL sections in one query. */
export async function getAllWebsiteContent(): Promise<Record<string, Record<string, any>>> {
  const { data, error } = await supabase
    .from('website_content')
    .select('section, content');
  if (error) throw error;
  const map: Record<string, Record<string, any>> = {};
  (data ?? []).forEach(row => { map[row.section] = row.content; });
  return map;
}

/** Upsert a section's content (admin only). */
export async function saveWebsiteSection(
  section: WebsiteSection,
  content: Record<string, any>,
): Promise<void> {
  const { error } = await supabase
    .from('website_content')
    .upsert({ section, content, updated_at: new Date().toISOString() }, { onConflict: 'section' });
  if (error) throw error;
}
