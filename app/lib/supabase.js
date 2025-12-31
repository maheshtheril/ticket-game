
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const supabaseUrl = 'https://ziuwwbibpgezzwobssae.supabase.co';
const supabaseKey = 'sb_publishable_0vZi31Un60sDMq_Ffq9M_Q_pY1XQSwu';

export const supabase = createClient(supabaseUrl, supabaseKey);
