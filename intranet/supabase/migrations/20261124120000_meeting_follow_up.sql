-- Follow-up-Mail nach einem Call: Betreff und Text, aus Zusammenfassung,
-- Aufgaben und Transkript geschrieben (Aufgaben → Aus Calls, Kundenakte → Calls)
alter table public.meeting_recordings add column if not exists follow_up jsonb;
