// js/supabase.js — Supabase Client Initialization

const SUPABASE_URL = 'https://pzyvlqkmidiwgivhghvo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXZscWttaWRpd2dpdmhnaHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTM2NTMsImV4cCI6MjA5NTU2OTY1M30.ehEUczTPBEP1x21Kc5XO7POzwSk35ZOYvx1Ig6OxW8I';

// Initialize only if not already initialized (preventing multiple declarations in some contexts)
if (typeof supabase === 'undefined' || (typeof supabase === 'object' && !supabase.from)) {
  var supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Helper for public URLs
function getPublicUrl(bucket, path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
