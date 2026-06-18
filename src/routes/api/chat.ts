import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent-prompt";

type Body = { messages?: UIMessage[]; threadId?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const url = process.env.SUPABASE_URL!;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supa = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supa.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const { messages, threadId } = (await request.json()) as Body;
        if (!Array.isArray(messages) || messages.length === 0 || !threadId) {
          return new Response("Bad Request", { status: 400 });
        }

        // Verify thread ownership (RLS will also enforce)
        const { data: thread, error: tErr } = await supa
          .from("agent_threads").select("id").eq("id", threadId).maybeSingle();
        if (tErr || !thread) return new Response("Thread not found", { status: 404 });

        // Persist latest user message
        const last = messages[messages.length - 1];
        if (last && last.role === "user") {
          await supa.from("agent_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            message: last,
          });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: AGENT_SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            const assistant = finalMessages[finalMessages.length - 1];
            if (assistant && assistant.role === "assistant") {
              await supa.from("agent_messages").insert({
                thread_id: threadId,
                user_id: userId,
                role: "assistant",
                message: assistant,
              });
              await supa.from("agent_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
            }
          },
        });
      },
    },
  },
});