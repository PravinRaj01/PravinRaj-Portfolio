import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY');
const DEFAULT_FOLDER_ID = '1W0BOH7HfQLCggD3MEU548uzjaq3kWoVN';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_DRIVE_API_KEY) {
      console.error('GOOGLE_DRIVE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const folderId = url.searchParams.get('folderId') || DEFAULT_FOLDER_ID;

    console.log(`Google Drive proxy request: action=${action}, folderId=${folderId}`);

    if (action === 'test') {
      // Test connection
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${GOOGLE_DRIVE_API_KEY}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Drive API error:', errorText);
        return new Response(
          JSON.stringify({ success: false, message: `API Error: ${response.status} ${response.statusText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const data = await response.json();
      return new Response(
        JSON.stringify({ success: true, message: `Connected successfully. Found ${data.files?.length || 0} files in folder.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'count') {
      // Get file count
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${GOOGLE_DRIVE_API_KEY}`
      );
      
      if (!response.ok) {
        console.error('Failed to fetch file count');
        return new Response(
          JSON.stringify({ count: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const data = await response.json();
      return new Response(
        JSON.stringify({ count: data.files?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list') {
      // List files from folder
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,thumbnailLink,webViewLink,parents)&key=${GOOGLE_DRIVE_API_KEY}`
      );
      
      if (!response.ok) {
        console.error('Failed to fetch files');
        return new Response(
          JSON.stringify({ files: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const data = await response.json();
      return new Response(
        JSON.stringify({ files: data.files || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: test, count, or list' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Google Drive proxy error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
