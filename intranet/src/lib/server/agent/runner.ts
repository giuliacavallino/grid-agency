import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { agentBrief, PROVIDERS, type PostProvider } from "@/lib/marketing";
import type { Task } from "@/lib/tasks";
import { db, sb } from "../db";
import { composePost, FORMAT, getAutopilot, ideaToPost, listIdeas, suggestPosts } from "../social/ideas";
import { publicMediaUrl } from "../social/media";
import { getBrand, listAccounts, listPosts, listWorkspaces } from "../social/store";
import { listTemplates, renderStatus, startRender, storeRender, toolsConfigured, voiceover } from "../video/tools";

// Der Agent als Teammitglied: To-dos, die an ihn übergeben wurden (auch aus
// Calls), arbeitet er mit den Werkzeugen des Marketing Hubs ab. Jeder Schritt
// landet im Protokoll der Aufgabe. Ob er Posts direkt einplanen darf, folgt
// dem Autopilot der Kundenakte („vollautomatisch“ oder „mit Freigabe“).

const MODEL = "claude-opus-5-5";
const MAX_STEPS = 14;
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

type Log = { at: string; text: string };

const POST_PROVIDERS = ["linkedin", "instagram", "facebook", "tiktok"] as const;

const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "DE", timezone: "Europe/Berlin" } },
  {
    name: "create_post",
    description:
      "Legt einen fertigen Post für eine Plattform im Redaktionskalender der Kundenakte an. Mit visual entsteht automatisch eine Grafik in der CI (Farben, Schrift, Logo). media_paths hängt vorhandene Medien an (z. B. ein Video aus render_video). schedule: \"none\" (Entwurf ohne Termin), \"next\" (nächster freier Termin) oder ISO-Zeitpunkt.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["provider", "caption", "hashtags", "schedule"],
      properties: {
        provider: { type: "string", enum: [...POST_PROVIDERS] },
        caption: { type: "string", description: "Fertiger Posttext ohne Hashtags" },
        hashtags: { type: "array", items: { type: "string" } },
        headline: { type: "string", description: "Kernaussage für die Grafik, max. 60 Zeichen; weglassen = keine Grafik" },
        subline: { type: "string" },
        media_paths: { type: "array", items: { type: "string" } },
        schedule: { type: "string" },
      },
    },
  },
  {
    name: "suggest_posts",
    description: "Recherchiert aktuelle Trends per Websuche und speichert Post-Vorschläge in der Kundenakte (für das Team sichtbar). Liefert die Vorschläge mit id.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["providers", "per_provider"],
      properties: {
        providers: { type: "array", items: { type: "string", enum: [...POST_PROVIDERS] } },
        per_provider: { type: "integer", minimum: 1, maximum: 5 },
        focus: { type: "string" },
      },
    },
  },
  {
    name: "post_from_idea",
    description: "Macht aus einem gespeicherten Vorschlag (id aus suggest_posts oder list_ideas) einen Post mit CI-Grafik.",
    input_schema: { type: "object", additionalProperties: false, required: ["idea_id", "schedule"], properties: { idea_id: { type: "string" }, schedule: { type: "string" } } },
  },
  { name: "list_ideas", description: "Offene Post-Vorschläge der Kundenakte.", input_schema: { type: "object", additionalProperties: false, properties: {} } },
  { name: "list_posts", description: "Posts der Kundenakte (Entwürfe, geplante, veröffentlichte) mit Termin und Textanfang.", input_schema: { type: "object", additionalProperties: false, properties: {} } },
  { name: "list_video_templates", description: "Video-Vorlagen in Creatomate (Motion Design, Reels).", input_schema: { type: "object", additionalProperties: false, properties: {} } },
  {
    name: "render_video",
    description:
      "Rendert ein Video aus einer Creatomate-Vorlage. modifications füllt Platzhalter, z. B. {\"Headline.text\": \"…\", \"Voiceover.source\": url}. Wartet bis zu 2 Minuten und liefert den Medienpfad für create_post.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["template_id", "modifications"],
      properties: { template_id: { type: "string" }, modifications: { type: "object", additionalProperties: true } },
    },
  },
  {
    name: "voiceover",
    description: "Spricht einen Text mit der Stimme aus der CI ein (ElevenLabs). Liefert eine öffentliche Adresse für Video-Vorlagen.",
    input_schema: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } },
  },
  {
    name: "finish",
    description: "Abschluss: kurze Zusammenfassung für das Team, was erledigt wurde und was noch fehlt. done=true, wenn die Aufgabe vollständig erledigt ist.",
    input_schema: { type: "object", additionalProperties: false, required: ["summary", "done"], properties: { summary: { type: "string" }, done: { type: "boolean" } } },
  },
];

const SYSTEM = `Du bist der Marketing-Agent von GRID AGENCY und arbeitest selbständig To-dos für einen Kunden ab – so, wie es eine erfahrene Social-Media-Managerin tun würde.

So arbeitest du:
- Lies die Aufgabe, das Briefing und die CI-Vorgabe genau. Halte dich strikt an Tonalität, Dos & Don'ts.
- Erledige, was mit deinen Werkzeugen möglich ist: recherchieren, Posts schreiben und anlegen, Vorschläge erstellen, Videos aus Vorlagen rendern, Voiceover erzeugen.
- Keine erfundenen Fakten, Zahlen, Zitate oder Personen. Fakten nur aus Briefing, Aufgabe oder Websuche.
- Was du nicht selbst erledigen kannst (z. B. Freigaben beim Kunden, Fotos vor Ort, Zugänge), nennst du in der Zusammenfassung als offene Punkte.
- Beende immer mit dem Werkzeug finish.`;

// ---------- Aufgaben ----------

async function save(task: Task, patch: Partial<Task>) {
  return (await db().update("tasks", task.id, patch as Record<string, unknown>)) as unknown as Task;
}

/** Aufgabe an den Agenten übergeben */
export async function handToAgent(taskId: string, by: string) {
  const task = (await db().get("tasks", taskId)) as unknown as Task | null;
  if (!task) throw new Error("Aufgabe nicht gefunden");
  if (task.agent_status === "running") throw new Error("Der Agent arbeitet schon daran");
  const log: Log[] = [...(task.agent_log ?? []), { at: new Date().toISOString(), text: `An den Agenten übergeben von ${by}` }];
  return save(task, { agent_status: "queued", agent_log: log, agent_at: new Date().toISOString(), assignee: "Agent" });
}

/** Übergabe zurücknehmen */
export async function stopAgent(taskId: string, by: string) {
  const task = (await db().get("tasks", taskId)) as unknown as Task | null;
  if (!task) throw new Error("Aufgabe nicht gefunden");
  const log: Log[] = [...(task.agent_log ?? []), { at: new Date().toISOString(), text: `Zurückgenommen von ${by}` }];
  return save(task, { agent_status: null, agent_log: log, assignee: task.assignee === "Agent" ? null : task.assignee });
}

/** Status atomar von queued auf running setzen (kein doppelter Lauf) */
async function claim(taskId: string) {
  if (DEMO) {
    const task = (await db().get("tasks", taskId)) as unknown as Task | null;
    if (task?.agent_status !== "queued") return null;
    return save(task, { agent_status: "running", agent_at: new Date().toISOString() });
  }
  const { data } = await sb().from("tasks").update({ agent_status: "running", agent_at: new Date().toISOString() }).eq("id", taskId).eq("agent_status", "queued").select("*").maybeSingle();
  return (data as Task | null) ?? null;
}

const short = (value: string, max = 140) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** Eine Aufgabe abarbeiten */
export async function runTask(taskId: string) {
  let task = await claim(taskId);
  if (!task) return null;
  const log: Log[] = [...(task.agent_log ?? [])];
  const note = async (text: string) => {
    log.push({ at: new Date().toISOString(), text });
    task = await save(task!, { agent_log: log });
  };

  try {
    const workspace = (await listWorkspaces()).find((w) => w.project_id === task!.project_id) ?? null;
    const project = await db().get("task_projects", task.project_id);
    const autopilot = workspace ? await getAutopilot(workspace.id) : null;
    const mode = autopilot?.mode ?? "review";
    const brand = workspace ? await getBrand(workspace.id) : null;
    const tools = toolsConfigured();
    const channels = workspace ? (await listAccounts(workspace.id)).filter((a) => a.provider !== "canva" && a.status === "active") : [];

    if (!process.env.ANTHROPIC_API_KEY) {
      if (!DEMO) throw new Error("ANTHROPIC_API_KEY fehlt");
      await note("Vorschau: Recherche und Post-Entwurf simuliert");
      if (workspace) {
        const post = await composePost(workspace.id, { provider: "linkedin", caption: `Entwurf zur Aufgabe „${task.title}“ (Vorschau ohne Claude-Schlüssel).`, hashtags: ["#gridagency"], visual: { headline: short(task.title, 60), format: "4:5" } }, { schedule: "next", mode: "review", by: "agent" });
        await note(`Post-Entwurf angelegt (${post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString("de-DE") : "ohne Termin"})`);
      }
      return save(task, { agent_status: "review", agent_result: "Vorschau: Der Agent hat einen LinkedIn-Entwurf mit CI-Grafik angelegt. Live arbeitet er mit Claude, Websuche und den angebundenen Werkzeugen." });
    }

    const context = [
      `Heute ist ${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "full" }).format(new Date())}.`,
      `Kunde: ${String(project?.name ?? workspace?.name ?? "unbekannt")}`,
      workspace
        ? `Posts: ${mode === "auto" ? "Du darfst Posts direkt einplanen; sie werden zum Termin veröffentlicht." : "Posts landen als Entwurf (gern mit Termin) und werden vom Team freigegeben."}`
        : "Für diesen Kunden gibt es keine Kundenakte im Marketing Hub: keine Posts anlegen, nur recherchieren und zusammenfassen.",
      `Verbundene Kanäle: ${channels.length ? channels.map((a) => `${PROVIDERS[a.provider].label} (${a.name})`).join(", ") : "noch keine – Posts bleiben Entwürfe"}`,
      `Werkzeuge: Video-Vorlagen ${tools.creatomate ? "verfügbar" : "nicht eingerichtet"}, Voiceover ${tools.elevenlabs ? "verfügbar" : "nicht eingerichtet"}.`,
      "",
      brand && workspace ? agentBrief(workspace.name, brand) : "",
      "## Briefing",
      String(project?.briefing ?? "(kein Briefing)").slice(0, 8000),
      "## Aufgabe",
      `Titel: ${task.title}`,
      task.notes ? `Notizen: ${task.notes}` : "",
      task.due_on ? `Fällig: ${task.due_on}` : "",
      task.checklist?.length ? `Checkliste:\n${task.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`).join("\n")}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: context }];
    let finished: { summary: string; done: boolean } | null = null;

    for (let step = 0; step < MAX_STEPS && !finished; step++) {
      const response = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "high" },
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });
      if (response.stop_reason === "refusal") throw new Error("Claude hat die Aufgabe abgelehnt");
      messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
      for (const block of response.content) {
        if (block.type === "server_tool_use" && block.name === "web_search") await note(`Websuche: ${short(String((block.input as { query?: string }).query ?? ""))}`);
      }
      if (response.stop_reason === "pause_turn") continue;
      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (!calls.length) {
        const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
        finished = { summary: text || "Ohne Zusammenfassung beendet", done: false };
        break;
      }
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        try {
          const output = await runTool(call.name, call.input as Record<string, unknown>, { workspaceId: workspace?.id ?? null, mode, voice: brand?.voice_id, note });
          if (call.name === "finish") finished = output as { summary: string; done: boolean };
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(output) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Fehler";
          await note(`Fehler bei ${call.name}: ${short(message)}`);
          results.push({ type: "tool_result", tool_use_id: call.id, content: message, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }

    const result = finished ?? { summary: "Abgebrochen: zu viele Schritte. Bitte Aufgabe genauer beschreiben.", done: false };
    await note(result.done ? "Fertig" : "Zur Prüfung an das Team");
    const done = result.done && mode === "auto";
    return save(task, {
      agent_status: result.done ? (done ? "done" : "review") : "review",
      agent_result: result.summary.slice(0, 6000),
      ...(done ? { done: true } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fehler";
    log.push({ at: new Date().toISOString(), text: `Abgebrochen: ${short(message)}` });
    return save(task, { agent_status: "failed", agent_log: log, agent_result: message });
  }
}

type ToolContext = { workspaceId: string | null; mode: "auto" | "review"; voice?: string; note: (text: string) => Promise<void> };

const needWorkspace = (id: string | null) => {
  if (!id) throw new Error("Keine Kundenakte: Posts sind für diesen Kunden nicht möglich");
  return id;
};

async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const by = "agent";
  switch (name) {
    case "create_post": {
      const workspaceId = needWorkspace(ctx.workspaceId);
      const provider = input.provider as PostProvider;
      const headline = typeof input.headline === "string" && input.headline.trim() ? input.headline.trim().slice(0, 90) : null;
      const paths = Array.isArray(input.media_paths) ? (input.media_paths as string[]).filter((p) => /^[0-9a-f-]{36}\/[a-z0-9-_]+\.(mp4|mov|png|jpg|webp)$/i.test(p)) : [];
      const post = await composePost(
        workspaceId,
        {
          provider,
          caption: String(input.caption ?? "").slice(0, 3000),
          hashtags: (input.hashtags as string[] | undefined)?.map(String).slice(0, 12),
          visual: headline ? { headline, subline: typeof input.subline === "string" ? input.subline.slice(0, 120) : undefined, format: FORMAT[provider] } : null,
          media: paths.map((path) => ({ path, mime: /\.(mp4|mov)$/i.test(path) ? "video/mp4" : "image/png", kind: /\.(mp4|mov)$/i.test(path) ? ("video" as const) : ("image" as const) })),
        },
        { schedule: String(input.schedule ?? "none"), mode: ctx.mode, by }
      );
      await ctx.note(`${PROVIDERS[provider].label}-Post ${post.status === "scheduled" ? "eingeplant" : "als Entwurf angelegt"}: ${short(post.caption, 80)}`);
      return { id: post.id, status: post.status, scheduled_at: post.scheduled_at, channels: post.account_ids.length };
    }
    case "suggest_posts": {
      const workspaceId = needWorkspace(ctx.workspaceId);
      const ideas = await suggestPosts(workspaceId, { providers: input.providers as PostProvider[], per_provider: Number(input.per_provider) || 3, focus: input.focus as string | undefined, by });
      await ctx.note(`${ideas.length} Post-Vorschläge recherchiert`);
      return ideas.map((i) => ({ id: i.id, provider: i.provider, title: i.title, trend: i.trend, caption: short(i.caption, 300) }));
    }
    case "post_from_idea": {
      needWorkspace(ctx.workspaceId);
      const post = await ideaToPost(String(input.idea_id), { schedule: String(input.schedule ?? "next"), mode: ctx.mode, by });
      await ctx.note(`Vorschlag umgesetzt: Post ${post.status === "scheduled" ? "eingeplant" : "als Entwurf"}`);
      return { id: post.id, status: post.status, scheduled_at: post.scheduled_at };
    }
    case "list_ideas": {
      const ideas = await listIdeas(needWorkspace(ctx.workspaceId));
      return ideas.filter((i) => i.status === "new").map((i) => ({ id: i.id, provider: i.provider, title: i.title, caption: short(i.caption, 200) }));
    }
    case "list_posts": {
      const posts = await listPosts({ workspace_id: needWorkspace(ctx.workspaceId), limit: 40 });
      return posts.map((p) => ({ id: p.id, status: p.status, scheduled_at: p.scheduled_at, caption: short(p.caption, 160) }));
    }
    case "list_video_templates":
      return listTemplates();
    case "render_video": {
      await ctx.note("Video wird gerendert");
      let render = await startRender({ template_id: String(input.template_id), modifications: (input.modifications as Record<string, unknown>) ?? {} });
      const until = Date.now() + 120_000;
      while (!["succeeded", "failed"].includes(render.status) && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        render = await renderStatus(render.id);
      }
      if (render.status !== "succeeded") throw new Error(render.error ?? "Rendern dauert zu lange");
      const item = await storeRender(render);
      if (!item) throw new Error("Video konnte nicht übernommen werden");
      await ctx.note("Video fertig");
      return { media_path: item.path };
    }
    case "voiceover": {
      const item = await voiceover(String(input.text ?? "").slice(0, 2500), ctx.voice);
      await ctx.note("Voiceover erstellt");
      return { url: publicMediaUrl(item.path) };
    }
    case "finish":
      return { summary: String(input.summary ?? ""), done: input.done === true };
    default:
      throw new Error(`Unbekanntes Werkzeug ${name}`);
  }
}

// ---------- Cron ----------

/** To-dos aus Calls automatisch übernehmen (je Kundenakte einstellbar) */
async function adoptCallTasks() {
  let adopted = 0;
  for (const workspace of await listWorkspaces()) {
    if (!workspace.project_id || !(await getAutopilot(workspace.id)).agent_calls) continue;
    const proposals = await db().list("meeting_tasks", { status: "vorschlag" });
    for (const proposal of proposals.filter((p) => p.project_id === workspace.project_id && p.owner !== "kunde")) {
      const claim = { status: "uebernommen", decided_by: "Agent", decided_at: new Date().toISOString() };
      if (!DEMO) {
        const { data } = await sb().from("meeting_tasks").update(claim).eq("id", proposal.id).eq("status", "vorschlag").select("id").maybeSingle();
        if (!data) continue;
      } else await db().update("meeting_tasks", String(proposal.id), claim);
      const task = await db().insert("tasks", { project_id: workspace.project_id, title: String(proposal.title), notes: (proposal.notes as string | null) || null, due_on: proposal.due_on ?? null, meeting_task_id: proposal.id });
      await db().update("meeting_tasks", String(proposal.id), { task_id: task.id });
      await handToAgent(String(task.id), "Autopilot (aus Call)");
      adopted++;
    }
  }
  return adopted;
}

/** Stündlich: Call-To-dos übernehmen, dann die älteste wartende Aufgabe bearbeiten */
export async function agentTick() {
  const adopted = await adoptCallTasks();
  const queued = DEMO
    ? ((await db().list("tasks", { done: "false" })) as unknown as Task[]).filter((t) => t.agent_status === "queued")
    : ((await sb().from("tasks").select("id").eq("agent_status", "queued").order("agent_at").limit(1)).data ?? []);
  // Hängengebliebene Läufe (Zeitlimit) nach 20 Minuten wieder freigeben
  if (!DEMO) {
    await sb().from("tasks").update({ agent_status: "queued" }).eq("agent_status", "running").lt("agent_at", new Date(Date.now() - 20 * 60_000).toISOString());
  }
  const next = queued[0] as { id: string } | undefined;
  const task = next ? await runTask(next.id) : null;
  return { adopted, ran: task ? { id: task.id, status: task.agent_status } : null };
}
