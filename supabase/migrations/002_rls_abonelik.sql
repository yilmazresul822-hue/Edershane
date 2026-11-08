alter table abonelik enable row level security;
create policy "kendi aboneliğini oku" on abonelik
  for select using (ogrenci_id = auth.uid());
