-- Fallback generated manually because the local Supabase CLI could not write its
-- telemetry file in this environment. Apply only to the Represas project.

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_conversations_user_updated_idx
  on public.agent_conversations (user_id, updated_at desc);

create index if not exists agent_messages_conversation_created_idx
  on public.agent_messages (conversation_id, created_at);

alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;

revoke all on public.agent_conversations, public.agent_messages from public, anon, authenticated;
grant select, insert, update, delete on public.agent_conversations to authenticated;
grant select, insert, update, delete on public.agent_messages to authenticated;

drop policy if exists "Users manage their own agent conversations" on public.agent_conversations;
create policy "Users manage their own agent conversations"
  on public.agent_conversations
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read their own agent messages" on public.agent_messages;
create policy "Users read their own agent messages"
  on public.agent_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users create messages in their own agent conversations" on public.agent_messages;
create policy "Users create messages in their own agent conversations"
  on public.agent_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users update their own agent messages" on public.agent_messages;
create policy "Users update their own agent messages"
  on public.agent_messages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users delete their own agent messages" on public.agent_messages;
create policy "Users delete their own agent messages"
  on public.agent_messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );
