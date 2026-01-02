
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kadsdqnpxzgdxnnrdzra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZHNkcW5weHpnZHhubnJkenJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzM3MDksImV4cCI6MjA2NDYwOTcwOX0.hBxdxwJOljZ4peYkYxN4Va_BcHqmqay7kQP7ijqio7s';

console.log('Initializing Supabase client...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Supabase client initialized successfully');
