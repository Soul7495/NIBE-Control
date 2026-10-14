# NIBE Control — UX Contract

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | setupDraft / previewSetup / saveSetup | Dashboard-Strategie | Einrichtung / Korrektur | tests/settings.test.mjs |
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


## Historie und Informationshierarchie 0.8
- `ncHistoryPoints` normalisiert echte ISO-/Epoch-Zeitstempel, erhält unbekannte Grenzen und reduziert in Zeitbuckets mit Extremwerten. `ncHistoryPath` unterbricht bei unbekannten Werten. Keine synthetische Index-Zeitachse.
- Frequenz und elektrische Leistung besitzen getrennte Diagramme und Einheiten. Reihen ohne Messwerte werden ausdrücklich bezeichnet. Legendenbuttons schalten Reihen sichtbar/verborgen. Nativer Zeitregler ist die Tastaturalternative zum Antippen eines Diagramms; Messwerte sind mit HA-Zeitzone beschriftet.
- Kein allgemeines Alterslimit für unveränderte HA-Sensoren: last_changed ist kein Nachweis ausgefallener Abfrage. Offline und unavailable bleiben explizit. Ein transportseitiger Frischebeleg fehlt.
- Einstellungen besitzt Datencheck; Diagnose enthält WP-Werte, Lüfterrohwert gehört zur Lüftung. Bestehende Bedien-/Wartungsbesitzer bleiben erhalten.

## Historie und Bedienrückmeldung 0.8.1
Recorder-Zustand gilt bis zur nächsten Änderung (Stufenkurve), letzte bekannte Zahl/unknown wird bis zum Anfrageende fortgeführt. Vor der ersten gelieferten Messung wird kein Zustand erfunden. Konstante Reihen erhalten eine gepolsterte Werteachse. Raw-Historie besitzt Messwertprüfung; reduzierte Punkte besitzen ausschließlich die Kurvengeometrie. `include_start_time_state=true` ist explizit. API-Quelle: home-assistant/core homeassistant/components/history/websocket_api.py, am 2026-10-14 gelesen.
`setUserControl` ist kanonischer Dispatcher für ausschließlich waterHeater/evccMode mit Domains, angebotenen Optionen, Offlineprüfung, Duplikatschutz und Inline-Fehlern. Erfolgsfeedback bestätigt Übermittlung, nicht die physische Ausführung.

## Datenzuordnung und Live-Verhalten 0.9
`src/profile.js` besitzt das einzige Geräteprofil; `resolveDiscovery` ist gleichzeitig Produkt- und Testbesitzer. NIBE-config_entry begrenzt Discovery; Mehrdeutigkeiten bleiben ungelöst. Manuelle Overrides bleiben auch bei Registryfehler. Installationsauswahl ist eine explizite Sitzungsvariante; dauerhafte Strategieconfig wird nur durch den Nutzer geändert.
`loadHistory` ist Single-Flight und generation-geschützt. Sichtbare Charts aktualisieren jede Minute; Öffnen/Wiederverbinden aktualisiert zusätzlich. Beim Entfernen Timer stoppen und Anfragen invalidieren. Fehler erhalten den letzten erfolgreichen Stand. Cursorzeit und ausgeblendete Reihen bleiben erhalten, „Jetzt anzeigen“ setzt den Cursor auf Live. `ncHistoryStats` ist zeitgewichtet mit Datenabdeckung, unbekannte Abschnitte sind ausgeschlossen.
Warmwasser-/EVCC-Steueroptionen werden live synchronisiert, ohne laufende Übermittlung zu überschreiben. Raumwerte benötigen ein numerisches Temperaturattribut. Datencheck/Qualitätsanzeigen folgen Livewerten. Zusatzheizaktivität ist auch bei fehlender Verdichterfrequenz nachweisbar; fehlender Heizstabstatus bestätigt keine vollständige Bereitschaft.

## Aliasauflösung 0.9.1
Mehrere Registertreffer werden nur dann als Sensor-/Number-Aliase behandelt, wenn unique_id und nichtleere device_id identisch sind, innerhalb der bereits ausgewählten NIBE-config_entry. Aktive Aliase haben Vorrang vor deaktivierten, danach der kanonische Domain-Typ. Echte Konflikte bleiben ungelöst. Schreiben auf Gradminuten bleibt ausgeschlossen. Die SG-Code-Tabelle aus yozik04/nibe extensions.json ist für S1155/S1255 begrenzt und wird nicht für VVM S320 genutzt.

## Community-Einrichtung 0.10 — ersetzt Sitzungsvariante aus 0.9
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | setupDraft / previewSetup / saveSetup | Dashboard-Strategie | Ersteinrichtung / spätere Korrektur | tests/settings.test.mjs |
| Entity-Auswahl | Native Input + gemeinsame Datalist | Registry und hass.states | manuell / automatisch / nicht verwenden | Domain-/Einheitentests |
| Geräteprofile | DEVICE_PROFILES / deviceProfile | src/profile.js; upstream Registertabellen | automatisch / manuell / generisch | Discovery-Tests, Registeraudit |
| Sichtbare Bereiche | capabilityState / applyVisibility | vorhandene Zuordnung + visibility | automatisch / manuell verborgen | fehlend/deaktiviert/unavailable Tests |

- Alle Eingaben sind zunächst Entwurf; nur „Einrichtung speichern“ schreibt Dashboard-Konfiguration. Keine Änderung beim Auswählen/Tippen. Keine Wärmepumpenservices während der Einrichtung.
- Speichern besitzt Duplikatschutz, Pending-Status, serverbestätigte Rückprüfung, Erhalt der Eingaben bei Fehler, erste fehlerhafte Entity im Fokus. Bestehende Filterkonfiguration und fremde Dashboard-Metadaten bleiben erhalten.
- HA-API: `src/data/lovelace/config/types.ts` im offiziellen Frontend: `lovelace/config` mit `force`, `url_path`; `lovelace/config/save` mit `config`, `url_path`. Vor der Mutation wird die aktuelle Rohkonfiguration gelesen. Nur NIBE-Dashboardstrategien werden gespeichert. YAML-/Rechtefehler blockieren und zeigen Handlungshinweis.
- Browserroute bestimmt die Dashboardadresse (erster Pfadabschnitt, lovelace → null); explizites dashboard_url_path ist bei direkter Kartenintegration möglich. Eine fremde Strategie wird niemals ersetzt.
- Konfliktprüfung vergleicht die vorher geladene Einrichtung mit dem aktuellen Serverstand. HA bietet hier keine CAS-Version; Änderungen zwischen Lesen und Schreiben können nicht atomar ausgeschlossen werden.
- Vorschläge basieren auf gewählter Installation und Profil. Mehrdeutigkeiten bleiben offen. Explizites null entfernt eine Rolle; leere Eingabe kehrt zu automatisch zurück. Nicht bekannte Mapping-Schlüssel bleiben erhalten.
- Raumtemperatur: climate.current_temperature oder sensor.state. Auswahl prüft Domains und physische Einheiten; W wird für Leistung nach kW, °F für Temperaturen nach °C normiert, auch im Verlauf.
- Weitere Geräteprofile sind nur anhand eindeutiger Titel/Einheiten in der NIBE-Bibliothek registergeprüft. Fehlende Rollen benötigen manuelle Zuordnung. Keine pauschale Hardwarefreigabe. Generische/weitere Profile verwenden keine numerische VVM-Prioritätsübersetzung.
- Warmwasser/Lüftung/EVCC: vorhandene registrierte Entities zählen auch bei deaktiviert/unavailable als erkannte Funktion; fehlende Funktionen sind verborgen. Manuell ausgeblendete Funktionen bleiben im Assistenten mit Status erkennbar. SG Ready bleibt unabhängig von EVCC sichtbar.
- Native Datalist akzeptiert plattformeigene Popup-Geometrie und Tastaturbedienung; Beschriftung, Validierung und Rückmeldung gehören der Anwendung. Pending sperrt alle Fieldsets. Entwürfe bleiben während Liveupdates bestehen, werden nicht lokal dauerhaft gespeichert.
