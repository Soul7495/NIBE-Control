# Review 0.11.0 — Synchronisation und Alarmaktivität

Stand: 14.11.2026. Ausgangspunkt: main fb86fd1186dfc8a1af86dd0844e6cd73be6da1f4, 0.10.3.

## Beobachtungen und Nachweise

Android-Video 66014.mp4: MyUplink meldet einwandfreien Betrieb, NIBE Control zeigt Alarmnummer 216 mit unbestätigter Aktivität. Die Betriebsanzeige wechselt; 0 Hz allein beweist dabei keine fehlerhafte Anzeige, weil Zusatzheizung ebenfalls Wärmeerzeugung sein kann. Der Nutzer bestätigt Verzögerungen auch bei dauerhaft geöffnetem Dashboard und HA Core 2026.11.x. Ein gleichzeitiger HA-Registerexport bzw. Zugriff auf die laufende Instanz liegt nicht vor. Die physische Ursache der unterschiedlichen Nummer/Leistung ist nicht abschließend nachgewiesen.

Vorher lief die Übersicht ausschließlich über neue hass-Zuweisungen. Ein Timer aktualisierte nur sichtbare Diagramme; ein Visibility-Handler fehlte. Ein stehen gebliebener Frontendstand konnte daher ohne zusätzliche HA-Anfrage erhalten bleiben. Ein neuer HA-Snapshot-Abgleich begrenzt diesen Fall auf die Abgleichperiode, sofern HA erreichbar ist; er kann veraltete Werte innerhalb der Integration nicht eigenständig reparieren.

## Alarmquelle korrigiert

NIBE M12676EN, TIF EN 2608, Common registers auf Seite 16: Active alarm, FC04, Adresse 2195, 0 = No alarm, 1 = Active alarm. Dies entspricht 32196 in der Bibliothek. nibe 2.25.0 benennt diesen Wert Class 1 alarm, u8, ohne boolesche Mappings; die HA-Integration stellt deshalb einen numerischen Sensor bereit. 0.10.3 schloss genau diese Domain aus und bot keine automatische Zuordnung. Diese Einschränkung ist korrigiert. Keine Erfindung eines Alarmtexts für 216, keine Interpretation anhand einer F-Serie-Codeliste.

- Für VVM S320/S325 registerbasierte, installationsgebundene Zuordnung.
- Kein pauschales Übernehmen in ungeprüfte/generische Geräteprofile.
- 0, 1, fehlend/unavailable und ungültige Werte getrennt. Bestätigter Alarm hat Priorität.
- Alarmnummer bleibt getrennt in Diagnose; kein automatischer Reset und keine Aktivierung deaktivierter Entities.
- Vorhandene manuelle Zuordnung bzw. explizites null bleibt erhalten.

## Synchronisation und Bedienung

- Sichtbares Dashboard gleicht HA-Zustände jede Minute ab; normale hass-Pushupdates bleiben erhalten.
- Rückkehr aus Hintergrund, Wiederverbindung und erneutes Einhängen gleichen sofort ab.
- Ein manueller Klick liest Registry und Device Registry neu und fordert über genau eine geeignete NIBE-Sensor-Entity den gemeinsamen Coordinator an. 15 Sekunden Mindestabstand; keine Geräte-Polls durch den automatischen Dashboard-Timer.
- get_states liefert einen HA-Snapshot. Gespeichert werden nur zugeordnete IDs. Der Snapshot ist vom hass-Objekt getrennt, neuere Pushwerte gewinnen, Mapping-/Lebenszykluswechsel verwerfen verspätete Antworten.
- Anfragen haben 30 Sekunden Deadline; Historie erhält bei Fehlern den letzten erfolgreichen Stand.
- Kein Neuaufbau von Formularen/Tabs beim Refresh. Native Zuordnungsfelder, bestehende Steuerung, Filter-Bestätigung, Diagramm-Cursor und XLSX-Export bleiben erhalten.
- HA-Stand bezeichnet den Dashboard-Abgleich. HA-Meldungs-/Änderungszeitstempel sind keine garantierten Geräte-Abfragezeitpunkte. Unveränderte Sensoren werden nicht allein aufgrund alter Zeitstempel als offline markiert.
- Header-Aktion teilt 44-px-Geometrie, Fokus und Themefarben mit dem Zahnrad. Pending/Fehler sind inline erreichbar, kein neues Modal für Refresh.

## Verifikation

- `npm test`: 117 Tests bestanden, einschließlich echter ausgelieferter Bundle-Fixtures und neuer Fälle für dauerhaft offene Ansicht, verspätete Antworten, Mappingwechsel, Disconnect/Reconnect, Wiederverwendung des hass-Objekts, Snapshot-Lücken, manuellen Coordinator-Refresh, Cooldown, Rechtefehler, Hintergrund, offene Entwürfe und Alarmaktivierung.
- `npm run check`: Source-/Bundle-Syntax bestanden.
- Strict-Premium-Audit: 0 Findings.
- `NIBE_CHROMIUM=/usr/bin/chromium npm run test:ui`: **nicht erfolgreich gestartet**. Chromium wird in dieser Umgebung vor dem Laden der Testseite mit `socket() failed: Operation not permitted` beendet. Keine visuelle Browserprüfung als bestanden behauptet. Der aktualisierte Runner beschreibt fünf Viewports, native Bedienung, Alarmfälle und Snapshot-Refresh für eine Umgebung mit verfügbarem Playwright-Browser.
- Bestehende Steuer-Allowlist unverändert. Einziger neuer HA-Service ist lesendes `homeassistant.update_entity` im manuellen Refresh; kein NIBE-Registerschreibbefehl.

## Reale Abnahme nach HACS-Update

1. In HA nur die benötigte Entity Class 1 alarm / 32196 aktivieren, falls deaktiviert. Nach Aktivierung Daten aktualisieren.
2. Alarmstatus 0 im Normalbetrieb gegen Gerät/MyUplink prüfen. Code 216 darf bei Status 0 keine aktive Störung auslösen. Bei Status 1 muss ein Alarm erscheinen; keinen Fehler künstlich erzeugen.
3. Dashboard dauerhaft offen lassen. Änderungen im HA-Entwicklerwerkzeug gegen Board und HA-Zeitstempel vergleichen. Nach spätestens einem erfolgreichen Minutenabgleich müssen dieselben HA-Werte angezeigt werden.
4. Manuellen Refresh prüfen: Pending, HA-Stand und ggf. nicht bestätigte Geräteabfrage unterscheiden. Keine gleichzeitige Neuladung der Integration erforderlich.
5. Hintergrund/Vordergrund, Netzwerkunterbrechung, geöffnete Einstellungen und Verläufe prüfen. Smartphone, Tablet und Shelly Wall Display optisch abnehmen.
6. Bleiben HA selbst und MyUplink unterschiedlich: genaue HA-Core-/NIBE-Firmwareversion, Entityzustände mit Attributen sowie nibe_heatpump-Protokolle für denselben Zeitraum erfassen. Kein Behaupten einer alleinigen Dashboardursache.

## Primärquellen

- https://professional.nibe.eu/document/Technical%20information%20(TIF)/M12676EN.pdf
- https://github.com/yozik04/nibe/blob/2.25.0/nibe/data/vvms320_vvms325.json
- https://github.com/yozik04/nibe/blob/2.25.0/nibe/coil.py
- https://github.com/home-assistant/core/blob/2026.11.1/homeassistant/components/nibe_heatpump/coordinator.py
- https://github.com/home-assistant/core/blob/2026.11.1/homeassistant/components/nibe_heatpump/entity.py
- https://github.com/home-assistant/core/blob/2026.11.1/homeassistant/helpers/update_coordinator.py
