# Supabase RLS Audit (C2) — 2026-04-19

Ziel: Sicherstellen, dass kein Cross-User-Leak in `grows`, `checkins`, Storage `checkin-photos` möglich ist.

## Ergebnis — OK mit 2 Hardening-Empfehlungen

| Tabelle/Bucket | SELECT | INSERT | UPDATE | DELETE | Isolation |
|---|---|---|---|---|---|
| `grows` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | ✅ sicher |
| `checkins` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | ✅ sicher |
| Storage `checkin-photos` | Pfad `{uid}/…` | Pfad `{uid}/…` | Pfad `{uid}/…` | Pfad `{uid}/…` | ✅ sicher |

`ALTER TABLE … ENABLE ROW LEVEL SECURITY` ist auf beiden Tabellen gesetzt (`supabase-schema.sql` Z. 69–70).

## Findings

### F1 — UPDATE/DELETE ohne WITH CHECK (low)
`update`-Policies prüfen nur `using`, nicht zusätzlich `with check`. Theoretisch könnte ein User eine fremde `user_id` beim UPDATE setzen und der Check würde nur gegen die alte Zeile laufen. In der Praxis niedrig, weil Client nicht versucht user_id zu manipulieren, aber Hardening empfohlen:

```sql
alter policy "Users update own grows" on grows
  rename to "Users update own grows (v2)";
drop policy "Users update own grows (v2)" on grows;
create policy "Users update own grows" on grows
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- analog für checkins.
```

### F2 — checkin.grow_id-Referenz nicht user-gebunden (low)
Beim INSERT/UPDATE in `checkins` wird nur `user_id = auth.uid()` geprüft. Ein User *könnte* eine `grow_id` eines anderen Users eintragen (FK-Constraint erlaubt das, da der fremde Grow existiert). Impact minimal — der User würde seinen eigenen Check-in mit falschem grow_id sehen, der fremde User bekäme ihn nie zu sehen (RLS filtert). Trotzdem Data-Integrity-Issue.

Fix:
```sql
drop policy "Users insert own checkins" on checkins;
create policy "Users insert own checkins" on checkins
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from grows g where g.id = grow_id and g.user_id = auth.uid())
  );
```

### F3 — Storage-Bucket ist private (✅ OK)
`public = false` + Policy pro Ordner `{uid}/…`. Signed-URLs werden nur kurzzeitig ausgegeben — Leak-Vektor zu. Weitere Ordnertiefe (z.B. `{uid}/{growId}/{file}`) wäre Belt-and-Suspenders, aktuell aber ausreichend.

## Prüfungsablauf (manuell für Play-Store-Submission wiederholen)

1. Supabase Dashboard → Authentication → neuer Test-User B
2. SQL Editor als User A: `select * from grows;` → nur A's Rows
3. Impersonate User B (`set role authenticated; set request.jwt.claims = '{"sub":"<B-UUID>"}';`) → select sieht nur B's Rows
4. Versuch Cross-User-Insert: `insert into grows(user_id, …) values ('<A-UUID>', …);` als B → muss fehlschlagen
5. Storage-Probe: `curl` als B auf `{A-UUID}/…` → 403

## Empfehlung (v1.4.0)

- F1 + F2 Patches in `supabase-schema.sql` ergänzen.
- In Play-Store-Test-Account manuellen Penetrationstest vor Submission durchführen.
- Datenbank-Logs für 401/403-Spikes monitoren (Anzeichen für Enumeration-Versuche).
