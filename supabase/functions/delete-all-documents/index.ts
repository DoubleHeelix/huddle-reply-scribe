import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import supabaseJs from 'https://esm.sh/@supabase/supabase-js@2.50.0/dist/umd/supabase.js?target=deno&deno-std=0.168.0';

const { createClient } = supabaseJs;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log(`🗑️ Deleting all documents for user: ${user.id}`);

    // Delete all rows from document_knowledge for the user
    const { error: deleteError } = await supabase
      .from('document_knowledge')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    // Also delete from storage (optional, but good practice)
    const { data: files, error: listError } = await supabase.storage
      .from('documents')
      .list(user.id);

    if (listError) {
      console.warn(`Could not list files for deletion: ${listError.message}`);
    } else if (files && files.length > 0) {
      const fileNames = files.map((file: { name: string }) => `${user.id}/${file.name}`);
      await supabase.storage.from('documents').remove(fileNames);
      console.log(`🗑️ Deleted ${fileNames.length} files from storage.`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'All documents and knowledge chunks deleted.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('❌ Delete all documents error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
