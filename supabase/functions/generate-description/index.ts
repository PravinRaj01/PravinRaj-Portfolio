import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateRequest {
  entityType: 'project' | 'experience';
  mode: 'professional' | 'creative';
  data: {
    title?: string;
    category?: string;
    categories?: string[];
    tags?: string[];
    positions?: string[];
    date?: string;
    period?: string;
    company?: string;
    location?: string;
    role?: string;
    images?: string[];
    achievements?: string[];
  };
  additionalContext?: string;
}

function buildPrompt(request: GenerateRequest): string {
  const { entityType, mode, data, additionalContext } = request;
  
  let contextParts: string[] = [];
  
  if (data.title) contextParts.push(`Title: "${data.title}"`);
  if (data.category) contextParts.push(`Category: ${data.category}`);
  if (data.categories?.length) contextParts.push(`Categories: ${data.categories.join(', ')}`);
  if (data.tags?.length) contextParts.push(`Tags: ${data.tags.join(', ')}`);
  if (data.positions?.length) contextParts.push(`Position(s)/Role(s): ${data.positions.join(', ')}`);
  if (data.role) contextParts.push(`Role: ${data.role}`);
  if (data.company) contextParts.push(`Company/Organization: ${data.company}`);
  if (data.location) contextParts.push(`Location: ${data.location}`);
  if (data.date) contextParts.push(`Date: ${data.date}`);
  if (data.period) contextParts.push(`Period: ${data.period}`);
  if (data.achievements?.length) contextParts.push(`Key achievements/highlights: ${data.achievements.join('; ')}`);
  if (data.images?.length) contextParts.push(`${data.images.length} image(s) uploaded`);
  
  const contextString = contextParts.join('\n- ');
  
  let styleGuide = '';
  if (mode === 'professional') {
    styleGuide = `
Style requirements for PROFESSIONAL mode:
- Write in a concise, formal, and technical tone
- Focus on impact, metrics, and outcomes where possible
- Use clear, direct language without excessive adjectives
- Keep it between 2-4 sentences
- Avoid markdown formatting, use plain text`;
  } else {
    styleGuide = `
Style requirements for CREATIVE mode:
- Write in an engaging, narrative style that tells a story
- Use vivid language and emotional connection
- Can use rich formatting with **bold** for emphasis and *italics* for quotes
- Keep it between 3-5 sentences, can be longer if the context is rich
- Feel free to use markdown formatting for emphasis`;
  }
  
  let entityGuide = '';
  if (entityType === 'project') {
    entityGuide = `
This is a PORTFOLIO PROJECT description. Focus on:
- What the project is about
- The role/contribution of the portfolio owner
- Key technologies, methods, or approaches used
- Impact or outcomes if apparent from context`;
  } else {
    entityGuide = `
This is a WORK EXPERIENCE / EVENT description. Focus on:
- What the role/event involved
- Key responsibilities or contributions
- Notable achievements or highlights
- The significance of this experience`;
  }
  
  let userContext = '';
  if (additionalContext?.trim()) {
    userContext = `

Additional context from user:
"${additionalContext}"`;
  }

  return `You are a professional portfolio writer. Generate a compelling description based on the following information.

${entityGuide}

${styleGuide}

Available information:
- ${contextString}${userContext}

Generate ONLY the description text. Do not include any preamble, labels, or explanations. Just the description itself.`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request: GenerateRequest = await req.json();
    
    // Validate request
    if (!request.entityType || !request.mode || !request.data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check minimum data
    if (!request.data.title?.trim()) {
      return new Response(
        JSON.stringify({ error: "Please fill in at least a title before generating", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(request);
    console.log("Generated prompt:", prompt);

    // Build messages array, optionally including image URLs for vision
    const messages: any[] = [
      { role: "system", content: "You are a professional portfolio writer. Generate compelling, accurate descriptions based on the provided context." }
    ];
    
    // If there are images, include them for vision analysis
    if (request.data.images?.length) {
      const content: any[] = [{ type: "text", text: prompt }];
      
      // Add up to 3 images for analysis (to manage token usage)
      const imagesToAnalyze = request.data.images.slice(0, 3);
      for (const imageUrl of imagesToAnalyze) {
        content.push({
          type: "image_url",
          image_url: { url: imageUrl }
        });
      }
      
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: false,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "AI is temporarily busy. Please try again in a minute.", 
            success: false 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "AI usage limit reached. Please try again later.", 
            success: false 
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate description", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const description = result.choices?.[0]?.message?.content?.trim() || "";

    if (!description) {
      return new Response(
        JSON.stringify({ error: "No description generated", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generated description:", description);

    return new Response(
      JSON.stringify({ description, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("generate-description error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error", 
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
