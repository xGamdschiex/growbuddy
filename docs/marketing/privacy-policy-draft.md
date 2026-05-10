# GrowBuddy — Datenschutzerklärung (Draft)

> **Status:** Draft — vor Play-Store-Submission anwaltlich prüfen lassen.
> URL: https://growbuddy.app/privacy (oder vercel-Subdomain)
> Dieser Draft erfüllt **DSGVO**, **CCPA-light** und **Google Play Data Safety**.

---

# Datenschutzerklärung GrowBuddy

**Stand:** {DATUM_PLATZHALTER} · **Version:** 1.0

## 1. Verantwortlicher

Lauritz Wirtz
{ADRESSE_PLATZHALTER}
55116 Mainz, Deutschland
E-Mail: privacy@growbuddy.app

## 2. Überblick

GrowBuddy ist ein **offline-first** Grow-Journal. Deine Daten werden primär
**lokal auf deinem Gerät** gespeichert (localStorage / WebView Storage).
Cloud-Synchronisation ist **optional** und nur nach expliziter Zustimmung
(Login mit E-Mail oder Google OAuth) aktiv.

## 3. Welche Daten verarbeiten wir?

### 3.1 Lokale Daten (auf deinem Gerät, immer)
- Grows (Name, Strain, Substrat, Phase, Notizen)
- Check-ins (Datum, Foto, Temperatur, EC, pH, VPD, Bewässerung, Nährstoffe)
- Einstellungen (Sprache, Reminder-Zeit, EC-Einheit)
- App-State (Onboarding-Status, XP, Streak)

**Speicherort:** Browser localStorage / WebView-Storage auf deinem Gerät.
**Zugriff:** Nur du. Wir haben keinen Zugriff auf lokale Daten.

### 3.2 Cloud-Daten (optional, nur bei aktiver Anmeldung)
Wenn du dich mit E-Mail-Magic-Link oder Google OAuth anmeldest, synchronisieren
wir folgende Daten mit unserem Backend (Supabase, EU-Server):
- E-Mail-Adresse (Account-ID)
- User-Profil: Username, Bio, Avatar (optional)
- Grows + Check-ins (deine eigenen)
- Cloud-Sync-Metadaten (`updated_at`, Konflikt-Resolution)

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung — Cloud-Sync).
**Speicherort:** Supabase EU (Frankfurt am Main, Deutschland).
**Speicherdauer:** Bis zur Konto-Löschung (auf Anfrage via privacy@growbuddy.app).

### 3.3 Public-Posts (Community-Feed)
Wenn du einen Grow oder Check-in als "Public" markierst, ist er im Community-Feed
für andere eingeloggte Nutzer sichtbar. Sichtbar werden:
- Username + Avatar
- Grow-Name + Strain
- Check-in-Inhalt (Foto, Phase, Notizen, Messwerte)

**Du kannst jederzeit auf "Privat" zurückstellen.** Bei Wechsel auf "Privat"
wird der Post sofort aus dem Feed anderer Nutzer entfernt.

## 4. Was wir NICHT erheben

❌ Keine Werbung, kein Tracking
❌ Keine Analyse-Tools (Google Analytics, Firebase Analytics, etc.)
❌ Keine Cookies (außer technisch nötige Session-Tokens bei Cloud-Sync)
❌ Kein Verkauf an Dritte
❌ Keine Crash-Reports (außer du sendest sie aktiv via Feedback-E-Mail)
❌ Kein Standort, keine Kontakte, keine Telefon-IDs

## 5. Drittanbieter

### 5.1 Supabase (EU)
Cloud-Sync läuft über Supabase Inc. (Server in Frankfurt am Main).
Datenschutzerklärung: https://supabase.com/privacy

### 5.2 Google OAuth (optional)
Wenn du "Mit Google anmelden" wählst, erhalten wir deine E-Mail + Google-User-ID.
Datenschutzerklärung Google: https://policies.google.com/privacy

### 5.3 Vercel (Web-Hosting der Begleit-Website)
Statisches Hosting der Marketing-Website (nicht der App).
Datenschutzerklärung: https://vercel.com/legal/privacy-policy

## 6. Deine Rechte (DSGVO)

Du hast jederzeit Anspruch auf:
- **Auskunft** (Art. 15 DSGVO): Welche Daten haben wir gespeichert?
- **Berichtigung** (Art. 16 DSGVO): Falsche Daten korrigieren lassen
- **Löschung** (Art. 17 DSGVO): "Recht auf Vergessenwerden"
- **Einschränkung** (Art. 18 DSGVO): Verarbeitung pausieren
- **Datenübertragbarkeit** (Art. 20 DSGVO): JSON-Export deiner Daten
  → In-App: Profil → Daten → Export
- **Widerspruch** (Art. 21 DSGVO): Cloud-Sync deaktivieren = Logout

Anfragen an: privacy@growbuddy.app

## 7. Foto-Berechtigung

Die Kamera-Berechtigung (Android) wird **nur lokal** für Check-in-Fotos benötigt.
Fotos werden komprimiert (max 256x256 für Avatar, ~800px für Check-ins) und in
deinem lokalen Storage gespeichert. Bei aktivem Cloud-Sync werden sie als
Base64 in deinen Account hochgeladen.

## 8. Push-Benachrichtigungen

Lokale Benachrichtigungen für tägliche Check-in-Erinnerungen werden **nur lokal
auf deinem Gerät** geplant (Capacitor LocalNotifications). Wir versenden keine
Server-Push-Nachrichten.

## 9. Kinder

GrowBuddy ist nicht für Kinder unter 18 Jahren bestimmt (wegen möglicher
Cannabis-Bezüge in Description und Community-Posts).

## 10. Änderungen

Wir können diese Datenschutzerklärung anpassen. Die jeweils aktuelle Version
ist immer unter https://growbuddy.app/privacy einsehbar.

## 11. Beschwerderecht

Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren:
- Landesbeauftragter für den Datenschutz Rheinland-Pfalz
- Hintere Bleiche 34, 55116 Mainz
- https://www.datenschutz.rlp.de

## 12. Kontakt

E-Mail: privacy@growbuddy.app
Allgemeine Anfragen: feedback@growbuddy.app

---

## Open Questions / TODOs vor Submission

- [ ] Adresse-Platzhalter mit echter Anschrift (Impressum nötig)
- [ ] Domain growbuddy.app registriert? Sonst URL anpassen
- [ ] Anwalt prüfen lassen (DSGVO + Play Store Data Safety)
- [ ] Play Console "Data Safety" Form ausfüllen (passend zu dieser Erklärung)
- [ ] Impressum separat erstellen (TMG §5)
- [ ] AGB/Nutzungsbedingungen falls Cloud-Sync gebührenpflichtig wird (Pro-Tier)
