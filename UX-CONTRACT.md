# NIBE Control — UX Contract

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Navigation | interne Tab-Leiste | `src/nibe-control.js` | Übersicht / Verläufe / Datencheck / Diagnose | Tastatur + schmaler Viewport |
| Raumtemperatur | Climate-Entity `current_temperature` | `src/profile.js` | Anzeige; Sollwert lokal nicht bedienbar | Unit-Test + HA-Livetest |
| Select/Listbox | native Select-Auswahl | `water_heater.operation_list` | nur bei angebotenen Modi | Tastatur + HA-Livetest |
| Scrollbar | Komponenten-Root | `DESIGN.md` Runtime mapping | Browser-Standardgeometrie | statischer Audit |
| Historie | HA WebSocket History | `src/nibe-control.js` | 24 h / leere Historie / Fehler | Unit-Test + HA-Livetest |
| Entity Discovery | Entity Registry + Register-ID | `src/profile.js` | automatisch / manueller Override | Unit-Test |
| Feedback | Inline-Zustand | `UX-CONTRACT.md` | verfügbar / deaktiviert / fehlt / offline | Unit-Test + HA-Livetest |
| Energie/PV | EVCC- und SG-Ready-Entities | `src/nibe-control.js` | vollständig / EVCC fehlt / Wert fehlt | Unit-Test + schmale Viewports |

## State behavior
- `unknown`, `unavailable` und fehlend werden als Gedankenstrich dargestellt.
- Deaktivierte empfohlene Entities erscheinen im Datencheck mit konkreter Anleitung.
- Statuscodes ohne belastbare Dokumentation werden als Rohcode bezeichnet.
- EVCC/PV sind optional und blockieren die NIBE-Ansicht nicht.
- Betriebspriorität 31029: 10=Bereit, 20=Warmwasser, 30=Heizung, 40=Pool, 60=Kühlung. Quelle: `yozik04/nibe/nibe/data/vvms320_vvms325.json` und `extensions.json` (M12676EN-1 Common Parameters).
- Aktive Wärmeerzeugung benötigt zusätzlich Verdichterfrequenz >0 oder Zusatzheizleistung >0. Unbekannte Daten bestätigen keinen aktiven Zweig. Alarm, Trennung und Abtauung haben Vorrang.
- SG-Eingänge: A/B offen=Normal, A geschlossen/B offen=Sperre, A offen/B geschlossen=Niedrigpreis, beide geschlossen=Überkapazität. Quelle: NIBE VVM S320 Installateurhandbuch 531158-2, AUX/SG Ready, https://www.nibe.eu/assets/documents/27032/531158-2.pdf . Unbekannte numerische SG-Modi werden nicht gemappt.
- EVCC-Anforderung ist eine Anforderung, kein Nachweis laufender Wärmeerzeugung oder vorhandenen PV-Überschusses.
- `paintValues()` aktualisiert Texte, Zustand und aktive Zweige ohne Neurendern von Tabs, Diagrammen oder Bedienfeldern.
- Das Energie-/PV-Board zeigt keine geschätzte PV-Leistung und leitet keinen Überschuss aus fachlich unbekannten Sensoren ab.
- Breakpoints: Desktop über 1100 px, Tablet/Wall Display bis 1100 px, Smartphone bis 760 px, kompakte Querformatdarstellung bei maximal 760 px Höhe.
## Filterwartung 0.6
- Kanonischer Besitzer: `bindMaintenance()` für Bestätigung und Schreibzugriff; `ncFilterDate()` für Kalenderberechnung.
- Datum stammt aus einem ausdrücklich konfigurierten `input_datetime`-Helfer mit `has_date=true`. Kein localStorage, kein automatisch erfundenes historisches Datum.
- „Filter gewechselt“ öffnet den app-eigenen nativen Modal-Dialog, schreibt noch nichts. Fokus auf Abbrechen, modaler Hintergrund inert, Escape schließt, Fokus kehrt zum Auslöser zurück.
- Nur der zweite Bestätigungsbutton ruft `input_datetime.set_datetime` für diesen Helfer auf. Während der Anfrage keine Doppelübermittlung, kein Schließen/Abbrechen. Fehler bleiben im Dialog, erfolgreiche Übermittlung wird inline angekündigt. Der Livezustand wird weiterhin von HA übernommen.
- Kein Reset einer NIBE-Meldung und keine Änderung von Lüfterstufen-/Installateurregistern.
- Datum nach HA-Zeitzone; deutsche Anzeige; Intervall 1–24 ganze Kalendermonate, ohne Default. Fehlende/falsche/future Daten erzeugen keinen Fälligkeitstermin.
- Plattform-eigene HA-Helferoberfläche übernimmt erstmalige Datumeingabe; kein neuer Kalender im Dashboard.

## Anlagenwahl und Filtereinrichtung 0.7
- `selectPlant()` besitzt den Wechsel zwischen zwei Anlagen. Die nicht gewählte Anlage ist verborgen; Auswahlzustand ist mit `aria-pressed` zugänglich. Kein Neuaufbau des Inhalts beim Wechsel, Eingaben und Charts bleiben erhalten.
- `bindMaintenance()` besitzt Einstellungen und Filterwechsel. Formularvalidierung erfolgt vor Öffnen des Bestätigungsdialogs; keine Speicherung beim Tippen oder beim ersten Übernehmen.
- Ersteinrichtung legt nach ausdrücklicher Bestätigung nur einen Datums- und einen Zahlenhelfer an. Name und Discovery sind an die NIBE-config_entry gebunden. Adminrechte werden ausschließlich durch HA geprüft. Bestehende explizite Datumsmappings werden weiter genutzt.
- HA-APIs: `input_datetime/list`, `/create`, `input_number/list`, `/create`, Entity Registry, `input_datetime.set_datetime`, `input_number.set_value`. Quelle: offizielle `home-assistant/core` Komponenten input_datetime/input_number und helpers/collection.py, geprüft 2026-10-08.
- Datum ist Pflicht und muss ein tatsächlicher Wechsel bis heute sein. Unbekannt bedeutet unkonfiguriert, ohne erfundenes Wartungsdatum. Monatsintervall bleibt von NIBE-Einstellungen unabhängig, bis diese eindeutig zugeordnet sind.
- Beim Erstellen keine `initial`-Werte speichern, damit spätere Wechsel/Intervalle nach Neustart wiederhergestellt werden. Bei Teilfehler keine automatische Wiederholung und kein Erfolgsstatus; bereits erzeugte Helfer bleiben erhalten und werden beim nächsten Versuch wiederverwendet. Gleichnamige Mehrfachhelfer blockieren automatische Zuordnung.
- Native Datumeingabe ist eine bewusst akzeptierte Plattformvariante. Fehler nutzen Text und aria-invalid; Bestätigungsdialog stellt Fokus wieder her und verhindert Doppelsenden.

