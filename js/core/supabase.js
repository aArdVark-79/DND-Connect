// Supabase client initialization. Kept separate from every feature module
// so nothing else needs to know how the client was constructed.
//
// NOTE: this key is the public "anon" key, which is meant to be exposed in
// browser code -- it is not a secret, and pretending otherwise here would
// be misleading. Access control is enforced server-side via RLS policies
// and SECURITY DEFINER functions, not by hiding this value.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://hmweboxsztxkgtgnkbvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2Vib3hzenR4a2d0Z25rYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzkwOTksImV4cCI6MjEwMzM1NTA5OX0.l6jQ7KQJ82vahll6F-5chFFDGsmC1cdTkUOcr327KLk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
