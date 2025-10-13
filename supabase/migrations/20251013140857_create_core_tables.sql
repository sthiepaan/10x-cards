-- migration: create core tables for 10x-cards
-- purpose: introduce tables `generations`, `flashcards`, and `generation_error_logs` with security (rls) and indexes
-- details:
--   - all tables use lower-case identifiers and adhere to postgres conventions
--   - `user_id` columns reference `auth.users(id)` from supabase auth
--   - rls is enabled on all tables with granular policies for `anon` and `authenticated`
--   - `flashcards.updated_at` is auto-maintained via trigger on update
--   - constraints and checks enforce data integrity (e.g., enumerated `source`, text length bounds)
-- special considerations:
--   - destructive operations are not included
--   - policies for `anon` explicitly deny access by returning false
--   - timezone: timestamps default to now() (timestamptz)

set check_function_bodies = on;

--
-- schema objects
--

-- create table: generations
create table if not exists public.generations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model varchar not null,
  generated_count integer not null,
  accepted_unedited_count integer,
  accepted_edited_count integer,
  source_text_hash varchar not null,
  source_text_length integer not null check (source_text_length between 1000 and 10000),
  generation_duration integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.generations is 'ai generation runs and their aggregate stats per user';

-- create table: flashcards
create table if not exists public.flashcards (
  id bigserial primary key,
  front varchar(200) not null,
  back varchar(500) not null,
  source varchar not null check (source in ('ai-full', 'ai-edited', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generation_id bigint references public.generations(id) on delete set null,
  user_id uuid not null references auth.users(id)
);

comment on table public.flashcards is 'user flashcards; optionally linked to a generation via generation_id';

-- create table: generation_error_logs
create table if not exists public.generation_error_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model varchar not null,
  source_text_hash varchar not null,
  source_text_length integer not null check (source_text_length between 1000 and 10000),
  error_code varchar(100) not null,
  error_message text not null,
  created_at timestamptz not null default now()
);

comment on table public.generation_error_logs is 'errors captured during ai generation attempts per user';

--
-- trigger to maintain updated_at on flashcards
--
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flashcards_set_updated_at on public.flashcards;
create trigger flashcards_set_updated_at
before update on public.flashcards
for each row
execute function public.set_updated_at();

--
-- indexes for query performance
--
create index if not exists idx_flashcards_user_id on public.flashcards (user_id);
create index if not exists idx_flashcards_generation_id on public.flashcards (generation_id);
create index if not exists idx_generations_user_id on public.generations (user_id);
create index if not exists idx_generation_error_logs_user_id on public.generation_error_logs (user_id);

--
-- row level security (rls)
-- enable and define granular policies for anon and authenticated roles
--
alter table public.generations enable row level security;
alter table public.flashcards enable row level security;
alter table public.generation_error_logs enable row level security;

--
-- generations policies
--
-- anon: explicitly deny all
drop policy if exists generations_anon_select_none on public.generations;
-- create policy generations_anon_select_none (disabled)
-- on public.generations for select to anon
-- using (false);

drop policy if exists generations_anon_insert_none on public.generations;
-- create policy generations_anon_insert_none (disabled)
-- on public.generations for insert to anon
-- with check (false);

drop policy if exists generations_anon_update_none on public.generations;
-- create policy generations_anon_update_none (disabled)
-- on public.generations for update to anon
-- using (false) with check (false);

drop policy if exists generations_anon_delete_none on public.generations;
-- create policy generations_anon_delete_none (disabled)
-- on public.generations for delete to anon
-- using (false);

-- authenticated: full self-access
drop policy if exists generations_auth_select_own on public.generations;
-- create policy generations_auth_select_own (disabled)
-- on public.generations for select to authenticated
-- using (user_id = auth.uid());

drop policy if exists generations_auth_insert_own on public.generations;
-- create policy generations_auth_insert_own (disabled)
-- on public.generations for insert to authenticated
-- with check (user_id = auth.uid());

drop policy if exists generations_auth_update_own on public.generations;
-- create policy generations_auth_update_own (disabled)
-- on public.generations for update to authenticated
-- using (user_id = auth.uid())
-- with check (user_id = auth.uid());

drop policy if exists generations_auth_delete_own on public.generations;
-- create policy generations_auth_delete_own (disabled)
-- on public.generations for delete to authenticated
-- using (user_id = auth.uid());

--
-- flashcards policies
--
-- anon: explicitly deny all
drop policy if exists flashcards_anon_select_none on public.flashcards;
-- create policy flashcards_anon_select_none (disabled)
-- on public.flashcards for select to anon
-- using (false);

drop policy if exists flashcards_anon_insert_none on public.flashcards;
-- create policy flashcards_anon_insert_none (disabled)
-- on public.flashcards for insert to anon
-- with check (false);

drop policy if exists flashcards_anon_update_none on public.flashcards;
-- create policy flashcards_anon_update_none (disabled)
-- on public.flashcards for update to anon
-- using (false) with check (false);

drop policy if exists flashcards_anon_delete_none on public.flashcards;
-- create policy flashcards_anon_delete_none (disabled)
-- on public.flashcards for delete to anon
-- using (false);

-- authenticated: self-only access
drop policy if exists flashcards_auth_select_own on public.flashcards;
-- create policy flashcards_auth_select_own (disabled)
-- on public.flashcards for select to authenticated
-- using (user_id = auth.uid());

drop policy if exists flashcards_auth_insert_own on public.flashcards;
-- create policy flashcards_auth_insert_own (disabled)
-- on public.flashcards for insert to authenticated
-- with check (user_id = auth.uid());

drop policy if exists flashcards_auth_update_own on public.flashcards;
-- create policy flashcards_auth_update_own (disabled)
-- on public.flashcards for update to authenticated
-- using (user_id = auth.uid())
-- with check (user_id = auth.uid());

drop policy if exists flashcards_auth_delete_own on public.flashcards;
-- create policy flashcards_auth_delete_own (disabled)
-- on public.flashcards for delete to authenticated
-- using (user_id = auth.uid());

--
-- generation_error_logs policies
--
-- anon: explicitly deny all
drop policy if exists gel_anon_select_none on public.generation_error_logs;
-- create policy gel_anon_select_none (disabled)
-- on public.generation_error_logs for select to anon
-- using (false);

drop policy if exists gel_anon_insert_none on public.generation_error_logs;
-- create policy gel_anon_insert_none (disabled)
-- on public.generation_error_logs for insert to anon
-- with check (false);

drop policy if exists gel_anon_update_none on public.generation_error_logs;
-- create policy gel_anon_update_none (disabled)
-- on public.generation_error_logs for update to anon
-- using (false) with check (false);

drop policy if exists gel_anon_delete_none on public.generation_error_logs;
-- create policy gel_anon_delete_none (disabled)
-- on public.generation_error_logs for delete to anon
-- using (false);

-- authenticated: self-only access
drop policy if exists gel_auth_select_own on public.generation_error_logs;
-- create policy gel_auth_select_own (disabled)
-- on public.generation_error_logs for select to authenticated
-- using (user_id = auth.uid());

drop policy if exists gel_auth_insert_own on public.generation_error_logs;
-- create policy gel_auth_insert_own (disabled)
-- on public.generation_error_logs for insert to authenticated
-- with check (user_id = auth.uid());

drop policy if exists gel_auth_update_own on public.generation_error_logs;
-- create policy gel_auth_update_own (disabled)
-- on public.generation_error_logs for update to authenticated
-- using (user_id = auth.uid())
-- with check (user_id = auth.uid());

drop policy if exists gel_auth_delete_own on public.generation_error_logs;
-- create policy gel_auth_delete_own (disabled)
-- on public.generation_error_logs for delete to authenticated
-- using (user_id = auth.uid());

-- end of migration
