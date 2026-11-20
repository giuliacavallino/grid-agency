-- Tage-Autopilot: Format je Post (Feed, Story, Karussell), Bezug zum
-- Social-Media-Tag und Verlauf der Änderungswünsche
alter table social_posts add column if not exists format text not null default 'feed';
alter table social_posts drop constraint if exists social_posts_format_check;
alter table social_posts add constraint social_posts_format_check check (format in ('feed', 'story', 'carousel'));
alter table social_posts add column if not exists day_id uuid references marketing_days(id) on delete set null;
alter table social_posts add column if not exists review jsonb not null default '[]'::jsonb;
create index if not exists social_posts_day_idx on social_posts (workspace_id, day_id) where day_id is not null;
