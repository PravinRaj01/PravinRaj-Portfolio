import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize user input to prevent prompt injection
function sanitizeInput(input: string, maxLength: number = 2000): string {
  if (!input || typeof input !== 'string') return '';
  
  let sanitized = input.slice(0, maxLength).trim();
  
  const dangerousPatterns = [
    /system:/gi,
    /assistant:/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
  ];
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, conversationHistory, contentMode = 'both' } = await req.json();
    
    const sanitizedMessage = sanitizeInput(message, 2000);
    if (!sanitizedMessage) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const sanitizedHistory = (conversationHistory || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: sanitizeInput(msg.content, 2000)
    })).slice(-10);

    // Validate content mode
    const validContentMode = ['professional', 'creative', 'both'].includes(contentMode) ? contentMode : 'both';

    // Fetch portfolio data for context (including socials and site settings for resume)
    // Build mode filter for queries that have a 'mode' column
    const buildModeQuery = (query: any, hasMode: boolean = true) => {
      if (!hasMode) return query;
      if (validContentMode === 'both') return query;
      return query.eq('mode', validContentMode);
    };

    const [heroResult, aboutResult, skillsResult, projectsResult, experiencesResult, educationResult, servicesResult, contactResult, socialsResult, certificationsResult, siteSettingsResult] = await Promise.all([
      // Hero content has mode - filter by mode
      buildModeQuery(supabase.from("hero_content").select("*"), true).limit(1).maybeSingle(),
      // About content has mode - filter by mode
      buildModeQuery(supabase.from("about_content").select("*").order("order_index"), true),
      // Skills has mode - filter by mode
      buildModeQuery(supabase.from("skills").select("*").order("order_index"), true),
      // Projects has mode - filter by mode  
      buildModeQuery(supabase.from("projects").select("*").order("order_index"), true),
      // Experiences has mode - filter by mode
      buildModeQuery(supabase.from("experiences").select("*").order("order_index"), true),
      // Education doesn't have mode - no filter
      supabase.from("education").select("*").order("order_index"),
      // Services doesn't have mode - no filter
      supabase.from("services").select("*").order("order_index"),
      // Contact content has mode - filter by mode
      buildModeQuery(supabase.from("contact_content").select("*"), true).limit(1).maybeSingle(),
      // Socials doesn't have mode - no filter
      supabase.from("socials").select("*").eq("enabled", true).order("order_index"),
      // Certifications doesn't have mode - no filter
      supabase.from("certifications").select("*").order("order_index"),
      supabase.from("site_settings").select("resume_url").limit(1).single(),
    ]);

    const hero = heroResult.data;
    const about = aboutResult.data || [];
    const skills = skillsResult.data || [];
    const projects = projectsResult.data || [];
    const experiences = experiencesResult.data || [];
    const education = educationResult.data || [];
    const services = servicesResult.data || [];
    const contact = contactResult.data;
    const socials = socialsResult.data || [];
    const certifications = certificationsResult.data || [];
    const siteSettings = siteSettingsResult.data;

    // Determine content mode label for context
    const modeLabel = validContentMode === 'both' 
      ? 'all content (professional and creative)' 
      : `${validContentMode} content only`;

    // Build comprehensive portfolio context
    const portfolioContext = `
## Content Mode
You are currently answering based on: ${modeLabel}

## Portfolio Owner Information
Name: ${hero?.name || "Portfolio Owner"}
Title: ${hero?.title || "Professional"}
Greeting: ${hero?.greeting || ""}
Description: ${hero?.description || ""}

## Resume
${siteSettings?.resume_url ? `Resume URL: ${siteSettings.resume_url}` : "Resume not available"}

## About
${about.map((a: any) => a.content).join("\n")}

## Skills & Technologies
${skills.map((s: any) => `**${s.category}**: ${s.skills?.join(", ") || ""}`).join("\n")}

## Projects
${projects.map((p: any) => `- **${p.title}** (${p.category}): ${p.description}${p.tags?.length ? ` | Technologies: ${p.tags.join(", ")}` : ""}${p.github_url ? ` | GitHub: ${p.github_url}` : ""}${p.live_url ? ` | Live: ${p.live_url}` : ""}`).join("\n")}

## Work Experience
${experiences.map((e: any) => `- **${e.title}** at ${e.company} (${e.period}): ${e.description}`).join("\n")}

## Education
${education.map((e: any) => `- **${e.degree}** from ${e.institution} (${e.period})`).join("\n")}

## Certifications & Achievements
${certifications.map((c: any) => `- **${c.name}** by ${c.issuer} (${c.date})${c.credential_id ? ` | Credential ID: ${c.credential_id}` : ""}${c.credential_url ? ` | Credential URL: ${c.credential_url}` : ""}`).join("\n")}

## Services Offered
${services.map((s: any) => `- **${s.title}**: ${s.description}`).join("\n")}

## Social Media & Online Presence
${socials.map((s: any) => `- **${s.name}**: ${s.url}`).join("\n")}

## Website Pages
- **Home** (/): Main landing page with hero section, about, skills, and featured projects
- **Projects** (/projects): Full portfolio of all projects with filtering options
- **Experience** (/experience): Work history and professional experience details
- **Academic** (/academic): Education background and certifications
- **Podcast** (/podcast): Podcast content and episodes
- **Contact** (/contact): Contact form and information
- **Playground** (/playground): Hidden fun page with interactive games! Users can access it by entering the Konami Code (↑↑↓↓←→←→BA) anywhere on the site, or by directly visiting /playground. Features retro arcade-style games like Neon Breakout.

## Contact
Email: ${contact?.email || "Not provided"}
${contact?.phone ? `Phone: ${contact.phone}` : ""}
${contact?.location ? `Location: ${contact.location}` : ""}
`;

    const systemPrompt = `You are a friendly and professional AI assistant for ${hero?.name || "this portfolio"}'s portfolio website. Your role is to help visitors learn about the portfolio owner, their skills, projects, experience, and services.

Here is the complete portfolio information you have access to:
${portfolioContext}

Guidelines:
- Be conversational, helpful, and professional
- Answer questions about the portfolio owner's background, skills, projects, and experience
- If asked about contacting, provide the contact information available
- Keep responses concise but informative (under 200 words unless more detail is needed)
- If asked something not related to the portfolio, politely redirect to portfolio topics
- Be enthusiastic about the portfolio owner's work and achievements
- If you don't have specific information, say so honestly rather than making things up

IMPORTANT - Rich Response Formatting:
When providing links or downloadable resources, use this special button syntax to create clickable buttons:
- For the resume: [button:Download Resume](URL_HERE)
- For credential verification: [button:View Credential](URL_HERE)
- For project links: [button:View Project](URL_HERE) or [button:GitHub Repo](URL_HERE)
- For social profiles: [button:LinkedIn](URL_HERE), [button:GitHub](URL_HERE), etc.
- For email: [button:Send Email](mailto:EMAIL_HERE)

Example: If someone asks for the resume, respond with something like:
"Here's ${hero?.name || "the portfolio owner"}'s resume! [button:Download Resume](${siteSettings?.resume_url || "#"})"

Always provide the button when you have the relevant URL available. This makes it easy for visitors to access resources directly.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...sanitizedHistory,
      { role: "user", content: sanitizedMessage }
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Calling Lovable AI Gateway for portfolio chat");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("Failed to get AI response");
    }

    return new Response(aiResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("Error in portfolio-chat:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
