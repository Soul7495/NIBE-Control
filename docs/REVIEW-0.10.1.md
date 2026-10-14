# Review NIBE Control 0.10.1

Stand: 14.10.2026. Basis: veröffentlichte 0.10.0, vollständiger Quellcode, aktueller 111-Sekunden-Livecheck `55244.mp4`, automatisierte Tests der ausgelieferten Komponente und unabhängiges Lesen der Excel-Ausgabe.

## Ergebnis
Die gefundenen Code-/Bedienfehler sind korrigiert. 95 Tests, Produktionsbuild, Syntaxprüfung und statischer UI-Audit bestehen. Dies ist ein vollständiger Review der vorhandenen Funktionsbereiche, keine Behauptung einer vollständigen Hardware- oder Browserzertifizierung des neuen Builds.

| Bereich | Prüfumfang | Ergebnis / Grenze |
|---|---|---|
| Einstieg und Navigation | WP/Lüftung getrennt, Tabs, Zahnrad, keine erzwungene Ersteinrichtung | Große Einrichtungsschaltfläche entfernt. Zahnrad besitzt Name, Fokus und Touchfläche. Kein neuer DOM-Aufbau beim Anlagenwechsel. |
| Einrichtung | Automatisch / Manuell / Nicht verwenden; aktive Entity-Liste; Domains/Einheiten; spätere Änderung | Datalist durch native Selects ersetzt. Manuell schaltet die echte Entity-Auswahl frei. Optionen werden beim Öffnen der Gruppe geladen; gewählte Entity bleibt erhalten. |
| Speicherung | HA-Strategie, Rückprüfung, Fehler, Offline, konkurrierende Änderung, Duplikat | Bestehende Filterkonfiguration und fremde Felder bleiben erhalten. Keine Speicherung beim Auswählen. HA besitzt keine atomare Compare-and-Swap-API für diesen Ablauf. |
| Discovery und Profile | Registry/config_entry, Sensor-/Number-Aliase, mehrere Anlagen, manuelle Overrides, generisch | Mehrdeutigkeiten werden nicht geraten. Weitere Profile bleiben Teilprofile ohne Hardwaretest. |
| Messwerte | unknown/unavailable/null, Climate-Raumtemperatur, eigener Sensor, W/°F, Nullwerte | Keine erfundenen Nullwerte. Physische Nullwerte bleiben Null. Raum-Sollregister ist weiterhin nur Diagnose. |
| Betrieb und Animation | Heizung/Warmwasser, Zusatzheizung, Verdichter, Alarm, Abtauung, Disconnect | Priorität allein bestätigt keine laufende Wärmeerzeugung. Unbekannte Profile bestätigen keine numerische Betriebsart. Reduced Motion bleibt vorhanden. |
| Warmwasser | angebotene Modi, nicht angebotene Modi, Domain, Fehlermeldung, Mehr-Warmwasser-Rohcode | Nur bestehende freigegebene HA-Funktion. Kein erfundener Boost-/Registerbefehl. |
| Energie, EVCC, SG Ready | Anforderung vs Betrieb, optional/ausgeblendet, bekannte Texte, Kontakte, unbekannte Codes | EVCC ist kein Nachweis für PV-Überschuss. SG-Code 10 wird für VVM S320 weiterhin nicht geraten. |
| Diagramme | Zeitfenster, echte Zeitstempel, konstante Reihe, Null, unbekannte Lücke, Stufen, Achsen, Cursor, Statistiken | Alle vorhandenen Tests für Hold-Verlauf, Einheiten, gemeinsamen Cursor, alte Antworten und Refresh bestehen. Keine erneute Änderung der Kurvengeometrie. |
| Excel | 6/12/24 Stunden, alle zugeordneten numerischen Rollen, Zeitreihe/Zustandswechsel/Zuordnung | Eigene lokale XLSX-Ausgabe, keine CDN-Bibliothek. Zahlen und Excel-Datum sind echte Zellen. UTC-Spalte unterscheidet doppelte Ortszeiten. |
| Excel-Qualität | Rohereignisse, gehaltene Zustände, Klimaattribute, Einheitennormierung, unbekannt, leere Historie, Fehler, Duplikat, geänderte Zuordnung | Keine lineare Interpolation, keine Diagrammreduktion. Blanks für unbekannte Werte. Mehr als 50.000 Ereignisse / 300.000 Zellen werden mit Hinweis abgelehnt statt gekürzt. |
| Diagnose | markierte Heizleistung/QN10, Abtauung, Betriebspriorität, Quellen | Deaktivierte Quellen bleiben ehrlich leer; Quelle/Hilfe erklärt die Aktivierung und bietet den Sprung zur Zuordnung. OFF und belegte Abtau-Binärwerte werden verständlich beschriftet. |
| Lüftung | Zu-/Abluftprozente, Luftbewegung, unbekannter Rotor, fehlende Daten | Keine Rotoraktivität oder Wärmerückgewinnung geschätzt. Lüftersteuerung weiterhin gesperrt, solange kein vollständiger belegter Steuerweg existiert. |
| Filterwartung | Datum/Monate, Monatsende, Zeitzone, Helferidentität, Zweitbestätigung, Teilfehler, Fokus | Bestehender Besitzer und zweistufige Bestätigung unverändert; bestehende Tests bestehen. Keine NIBE-Quittierung. |
| Sicherheit und Daten | Allowlist, reine Leseabfragen beim Export, HTML/XML-Escaping, Text als InlineString | Keine neuen NIBE-Schreibrechte, keine Cloud/Telemetrie. Formelähnliche Namen werden Excel-Text, keine Formeln. |
| Responsive und Theme | vorhandene Smartphone-/Tablet-/Wall-Display-Regeln, natürliche Seitenhöhe, native Felder, HA-Tokens | Quellen-/Markupreview und altes Android-Livevideo geprüft. Neue native Popupdarstellung und reale Displaygeometrie sind noch nicht live verifiziert. |

## Nachweise

- `npm test`: 95 erfolgreich, 0 fehlgeschlagen. `tests/live.test.mjs`, `tests/settings.test.mjs`, `tests/export.test.mjs` führen die gebündelte dist-Komponente aus.
- `npm run build`, `npm run check`: erfolgreich.
- Premium-Audit im Strict-Modus: keine Findings.
- Unabhängiger XLSX-Lesetest mit Python zipfile/XML und openpyxl im Read-only-Modus: CRCs, XML, Beziehungen, Blattnamen, numerische Zellen und Datumszellen gültig.
- Video vollständig über Kontaktbogen und relevante Originalframes geprüft: dominante Einrichtung, Android-Datalist, deaktivierte Diagnosequellen, unverständliche OFF-/Abtaubeschriftung.

## Noch live zu prüfen

1. Der 0.10.1-Entity-Popup auf Android/HA-App, Tablet und Shelly Wall Display. Native Auswahl folgt der jeweiligen Plattform; im neuen Build kein Texteingabe-/Datalist-Fallback.
2. Tatsächliche HA-Dashboard-Speicherung und Rückmeldung auf mehreren Displays; diese wurde mit der offiziellen API und Mocks geprüft.
3. XLSX-Dateizustellung in der HA-Android-WebView. Dateiinhalte sind geprüft; Blob-Download hängt von Browser/App ab. Bei App-Problemen das Dashboard im Browser öffnen. Keine behauptete native Android-Download-Freigabe.
4. Reale Warmwasser-/EVCC-Befehle und Filterhelferanlage nach Bestätigung. In Tests wurden keine Wärmepumpenregister beschrieben.
5. Deaktivierte thermische Leistung/QN10 und nicht verfügbare SG-Eingänge müssen in der bestehenden NIBE-Integration geprüft/aktiviert werden. Der Dashboard-Build erzeugt diese Messwerte nicht.

Es wurden keine neuen Livewerte, Statuscodes oder Gerätefunktionen erfunden, um diese Grenzen zu verdecken.
