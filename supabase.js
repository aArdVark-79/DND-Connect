import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://hmweboxsztxkgtgnkbvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2Vib3hzenR4a2d0Z25rYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzkwOTksImV4cCI6MjEwMzM1NTA5OX0.l6jQ7KQJ82vahll6F-5chFFDGsmC1cdTkUOcr327KLk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
