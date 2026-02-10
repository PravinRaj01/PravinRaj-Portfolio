import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_ids, theme_hint } = await req.json();

    // Fetch projects — either specific ones or featured creative projects
    let query = supabase
      .from("projects")
      .select("id, title, description, tags, category, image_drive_id, image_home_drive_id, featured, position, positions, categories")
      .eq("mode", "creative")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (project_ids && project_ids.length > 0) {
      query = query.in("id", project_ids);
    } else {
      query = query.eq("featured", true);
    }

    const { data: projects, error: dbError } = await query;
    if (dbError) throw dbError;

    if (!projects || projects.length === 0) {
      return new Response(
        JSON.stringify({ error: "No projects found to generate magazine from" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectSummaries = projects.map((p, i) => 
      `Project ${i + 1}: "${p.title}" — ${p.description}. Tags: ${(p.tags || []).join(", ")}. Category: ${p.category}. Role: ${p.position || (p.positions || []).join(", ") || "Developer"}.`
    ).join("\n\n");

    const themeInstruction = theme_hint 
      ? `\nEditorial direction from the portfolio owner: "${theme_hint}"\n` 
      : "";

    const systemPrompt = `You are the Editor-in-Chief of "Code & Creative", a high-end tech magazine showcasing the work of a talented developer named Pravin Raj.

Your task: Take these project descriptions and craft a compelling magazine issue. Write in sophisticated, narrative journalistic style — NOT resume-speak. No "utilized", no "leveraged". Instead, tell stories. Be slightly witty, insightful, and engaging.

Rules:
- Cover headline should be bold and attention-grabbing
- Editor's note should be warm and set the tone for the issue
- Each article should read like a feature story, not a project description
- Pull quotes should be memorable one-liners
- The closing page should be an invitation to connect
- Use varied layouts for visual interest: "split_left", "split_right", "full_bleed"
- Keep article bodies to 2-3 paragraphs (150-250 words each)
${themeInstruction}
Here are the projects to feature:

${projectSummaries}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the magazine issue now. Use the generate_magazine_issue tool to return the structured content." },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_magazine_issue",
              description: "Generate a structured magazine issue with cover, editor's note, articles, and closing page.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Issue title, e.g. 'The AI Architect — Feb 2026'" },
                  cover: {
                    type: "object",
                    properties: {
                      headline: { type: "string", description: "Bold cover headline" },
                      subhead: { type: "string", description: "Cover subtitle" },
                    },
                    required: ["headline", "subhead"],
                  },
                  editors_note: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Editor's note title" },
                      body: { type: "string", description: "Editor's note body (2-3 paragraphs)" },
                    },
                    required: ["title", "body"],
                  },
                  articles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        project_id: { type: "string", description: "UUID of the project" },
                        headline: { type: "string", description: "Article headline" },
                        pull_quote: { type: "string", description: "A memorable quote from the article" },
                        body: { type: "string", description: "Article body (2-3 paragraphs, 150-250 words)" },
                        layout: { type: "string", enum: ["split_left", "split_right", "full_bleed"], description: "Page layout style" },
                      },
                      required: ["project_id", "headline", "pull_quote", "body", "layout"],
                    },
                  },
                  closing: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Closing page title" },
                      body: { type: "string", description: "Closing call-to-action text" },
                    },
                    required: ["title", "body"],
                  },
                },
                required: ["title", "cover", "editors_note", "articles", "closing"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_magazine_issue" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      throw new Error(`AI Gateway returned ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "generate_magazine_issue") {
      console.error("Unexpected AI response:", JSON.stringify(aiData));
      throw new Error("AI did not return expected tool call");
    }

    const magazineContent = JSON.parse(toolCall.function.arguments);

    // Attach image drive IDs from actual projects
    const projectMap = new Map(projects.map(p => [p.id, p]));
    for (const article of magazineContent.articles) {
      const proj = projectMap.get(article.project_id);
      if (proj) {
        article.image_drive_id = proj.image_home_drive_id || proj.image_drive_id;
      }
    }

    // Use first project's image as cover if available
    if (projects[0]) {
      magazineContent.cover.cover_image_drive_id = projects[0].image_home_drive_id || projects[0].image_drive_id;
    }

    return new Response(
      JSON.stringify({
        title: magazineContent.title,
        cover_headline: magazineContent.cover.headline,
        cover_subhead: magazineContent.cover.subhead,
        content: magazineContent,
        project_ids: projects.map(p => p.id),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-magazine error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
