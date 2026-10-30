-- Aufgaben (Ersatz für Asana): je Kunde ein Board, Themen als Spalten,
-- To-dos als Karten. Das Briefing (Zugänge, Ansprechpartner, Postingplan)
-- hängt am Kunden. asana_gid hält die Herkunft aus dem einmaligen Import fest.
create table public.task_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  color text not null default '#afaaa0',
  customer_id uuid references public.customers (id) on delete set null,
  position double precision not null default extract(epoch from now()),
  archived boolean not null default false,
  briefing text,
  asana_gid text unique
);

create table public.task_sections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.task_projects (id) on delete cascade,
  name text not null,
  position double precision not null default extract(epoch from now())
);
create index task_sections_project_idx on public.task_sections (project_id, position);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references public.task_projects (id) on delete cascade,
  section_id uuid references public.task_sections (id) on delete set null,
  title text not null,
  notes text,
  done boolean not null default false,
  done_at timestamptz,
  assignee text,
  due_on date,
  checklist jsonb not null default '[]',
  position double precision not null default extract(epoch from now()),
  asana_gid text unique
);
create index tasks_project_idx on public.tasks (project_id, done, position);

alter table public.task_projects enable row level security;
alter table public.task_sections enable row level security;
alter table public.tasks enable row level security;

create function public.touch_task() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.done and (tg_op = 'INSERT' or not old.done) and new.done_at is null then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.touch_task();
