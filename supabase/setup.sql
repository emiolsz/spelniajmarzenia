create table if not exists public.marzenia_articles (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 date date not null,
 body text not null,
 photos jsonb not null default '[]'
);
alter table public.marzenia_articles enable row level security;
revoke all on public.marzenia_articles from anon, authenticated;
grant select, insert, update on public.marzenia_articles to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('marzenia-photos','marzenia-photos',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
