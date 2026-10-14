# NIBE Control 0.10.0

## Neu in 0.5.0
Erkennbare Außen-/Inneneinheit mit exakt angeschlossenen Leitungen. Heizkreis und Warmwasser bleiben auf jedem Display sichtbar. Betriebsart und Animation wechseln live, ohne die Oberfläche neu aufzubauen.

Für die Unterscheidung von Heizbetrieb und Warmwasserbereitung: `sensor.priority_31029` aktivieren. Codes 10/20/30/40/60 stammen aus dem VVM-S320-Profil der bestehenden NIBE-Bibliothek. EVCC-Anforderung wird nicht als tatsächlicher Heizbetrieb interpretiert. SG Ready wird aus den verfügbaren Eingängen A/B gemäß NIBE-Handbuch bestimmt; unbekannte numerische SG-Modi bleiben Rohcodes.

Dynamisches, lokales Home-Assistant-Dashboard für NIBE-Wärmepumpen der S-Serie. Das VVM-S320-Profil wurde gegen den Entity-Export vom 04.10.2026 mit 819 Entitäten geprüft.

## Funktionen
- Community Dashboard Strategy für Home Assistant 2026.5+
- responsive Live-Anlagenansicht für Smartphone und Desktop
- Registry-/Register-basierte Entity-Erkennung statt fester Namen
- Heizung, Warmwasser, Energie, SG Ready und Diagnose
- lokale 24-h-SVG-Verläufe ohne externe Bibliothek
- integrierter Datencheck für deaktivierte oder fehlende Entities
- sichere Schreib-Allowlist
- gemessene Raumtemperatur aus Climate oder einem frei gewählten Temperatursensor
- optionale EVCC-Status- und Modusanzeige
- eigenes Energie-/PV-Board für EVCC-Anforderung, PV-Aktion, Anhebung und SG Ready
- responsive Layouts für Smartphone, Tablet und Shelly Wall Display
- Light/Dark Theme und reduzierte Bewegung

## Installation
1. In HACS unter **Frontend → Benutzerdefinierte Repositorys** die Repository-URL als Kategorie **Dashboard** hinzufügen.
2. NIBE Control installieren und Home Assistant/Browser neu laden.
3. **Einstellungen → Dashboards → Dashboard hinzufügen → Community-Dashboards → NIBE Control**.

## Empfohlene Entities
Der Datencheck im Dashboard zeigt exakt, welche zusätzlichen Entities für die vollständige Ansicht noch deaktiviert sind. Es werden keine Entities automatisch aktiviert.

Der MyUplink-Raum-Sollwert wird von der vorhandenen lokalen Integration nicht zuverlässig bereitgestellt. Register 40207 wird daher ausschließlich im Diagnosebereich angezeigt und nicht beschrieben.

## Sicherheit
`sensor.current_power_32177` wird nicht als Gesamtleistung genutzt. Dafür ist Register 32306 vorgesehen; 31807 bleibt die Außeneinheit. GP1 31103/31637 wird bis zum Livevergleich nicht automatisch gewählt. Register 40207 bleibt read-only. Kein rohes `number.*` oder `switch.*` wird allein aufgrund seiner Domain bedienbar gemacht.

## Entwicklung
```bash
npm test
npm run build
npm run check
```

## Lizenz
MIT. NIBE ist eine Marke des jeweiligen Rechteinhabers; dieses Community-Projekt ist nicht mit NIBE Energy Systems verbunden.

## Anlagenwahl und Filterwartung ab 0.8.1

Der Einstieg zeigt zwei Kacheln: **Wärmepumpe** und **Lüftung**. Wähle eine Anlage; die andere Detailansicht bleibt verborgen. Die Kacheln zeigen Livewerte und erlauben jederzeit den Wechsel. Heizungsdiagramme und Diagnose bleiben in der Wärmepumpenansicht erhalten.

### Einrichtung direkt im Dashboard

1. Lüftung öffnen → **Filterwartung einrichten / ändern**.
2. Das an deiner NIBE eingestellte Intervall in ganzen Monaten (1–24) eintragen. Die acht vorhandenen Filterregister werden weiterhin nicht ungeprüft zugeordnet.
3. Das Datum des letzten tatsächlichen Filterwechsels eintragen. Ist es unbekannt, erst nach dem nächsten echten Tausch einrichten.
3. **Einstellungen übernehmen** → Angaben prüfen → **Ja, Einstellungen speichern**. Erst die zweite Bestätigung speichert.
5. Bei erstmaliger Einrichtung erstellt HA einen Datumshelfer und einen Zahlenhelfer. Administratorrechte und die HA-Integrationen input_datetime/input_number müssen verfügbar sein. Der Helfername enthält die NIBE-Integrationskennung, damit mehrere Installationen getrennt bleiben. Die Daten überleben Neustarts und stehen auf allen Displays zur Verfügung.
6. Nach späterem Tausch **Filter gewechselt** wählen und im zweiten Dialog bestätigen.

Die Wartung zeigt letztes Datum, nächste Fälligkeit und verbleibende/überfällige Tage. Monatsenden und HA-Zeitzone werden berücksichtigt. Es wird keine NIBE-Filtermeldung quittiert und kein NIBE-Intervall verändert. Wenn ein Speicherschritt fehlschlägt, zeigt der Dialog einen Fehler; bereits angelegte Helfer bleiben erhalten. Eingaben prüfen und erneut speichern. Bei mehreren gleichnamigen Helfern ist eine explizite Zuordnung nötig. Helfer nicht umbenennen, solange sie nur automatisch anhand ihres ursprünglichen Namens zugeordnet sind.

### Bestehende Helfer / manuelle Zuordnung

Die bisherige `ventilation.filter_date_entity`-Konfiguration bleibt gültig. Optional kann in derselben Konfiguration `filter_interval_entity` auf einen vorhandenen input_number-Helfer zeigen (min 1, max 24, step 1). Ohne diesen Helfer bleibt das alte `filter_interval_months` lesbar; bei Einrichtung über die Oberfläche wird ein dauerhafter Intervallhelfer genutzt. Für neu angelegte Helfer sind keine YAML-Einträge erforderlich.

### Lüftungsdaten und Grenzen

ERS S40-400: GQ2 / Register 30136 ist Abluft, GQ3 / 30137 Zuluft. Luftwege bewegen sich nur bei gemeldeter Aktivität. Rotorbetrieb, Lufttemperaturen und Wirkungsgrad werden nicht geschätzt. Modus 31038 bleibt Diagnose-Rohwert. Lüftersteuerung samt Rückkehr zur Normalregelung ist weiterhin gesperrt: Die vorhandene Integration liefert keinen vollständigen belegten Steuerweg. Fest konfigurierte Stufenprozente bleiben unangetastet.

### Verifizierung

83 automatisierte Tests, Build, Syntaxprüfung und statischer UI-Audit bestanden. Echte HA-Helfererstellung, Tastaturbedienung im Browser und visuelle Darstellung auf Smartphone/Tablet/Wall Display müssen noch live geprüft werden.

## UI 0.8
Kompakte Übersicht, Warmwasserbedienung aufklappbar, technische Details eingeklappt. Verläufe trennen Hz und kW und verwenden echte Zeitstempel. Diagramme antippen oder den Zeitregler nutzen; Legenden schalten einzelne Reihen. Einstellungen enthält den Datencheck. Lüfterwerte sind Ventilatorprozente und kein gemessener Volumenstrom. Liveprüfung in HA und auf Zielgeräten steht noch aus.

## Diagrammkorrektur 0.8.1
Recorder-Zustände werden bis zur nächsten Änderung horizontal gehalten; Sprünge werden vertikal gezeichnet. Konstante Werte wie Vorlauf Soll 31 °C reichen bis zum abgefragten Zeitfensterende. Unbekannte Zustände unterbrechen die Kurve. Die Y-Achse steht links, Minimum unten; Zeitmarken folgen der HA-Zeitzone. Die Messwertprüfung liest die ungekürzten Ereignisse.

Funktionsprüfung: 83 automatisierte Tests für Historie, Rendering, Discovery, Betriebszustände, SG Ready/EVCC, sichere Bedienung, Fehler-/Offlinefälle, Navigation und Filterwartung. Build/Syntax und statischer UI-Audit bestanden. Echte HA-Livewerte und visuelle Smartphone-/Tablet-Prüfung sind weiterhin offen; die Browserumgebung blockiert lokale HTML-Vorschauen.

## 0.9: Verläufe auswerten
- Zeitraum 6, 12 oder 24 Stunden auswählen. Die Zeitachse und Einheit sind direkt am Diagramm sichtbar.
- Kurve antippen oder Zeitregler bewegen: Die vertikale Markierung und Messwerttabellen aller Diagramme zeigen denselben Zeitpunkt mit Datum, Uhrzeit, Namen und Einheiten. „Jetzt anzeigen“ kehrt zur aktuellen Randzeit zurück.
- Heizkreis zeigt die Differenz Vorlauf Ist − Soll. Frequenz zeigt, ob der Verdichter am ausgewählten Zeitpunkt läuft oder steht.
- „Auswertung des Zeitraums“ zeigt Minimum, Maximum, zeitgewichtetes Mittel und Datenabdeckung. Verdichterlaufzeit und beobachtete Starts stammen ausschließlich aus bekannten Abschnitten. Die Werte sind keine Effizienz-/Fehlerbewertung.
- Verläufe werden beim Öffnen, bei Wiederverbindung und jede Minute bei sichtbarer Verlaufsansicht aktualisiert. Ein gewählter Zeitpunkt und ausgeblendete Reihen bleiben erhalten. Bei Fehlern bleiben alte Kurven mit einer Fehlermeldung sichtbar.

## Community-Einrichtung ab 0.10.0

1. Dashboard öffnen → **Einrichtung / Einstellungen**. Bei noch nicht abgeschlossener Einrichtung öffnet sich der Assistent für Administratoren automatisch.
2. Unter **Anlage auswählen** deine NIBE-Installation und das Wärmepumpenprofil wählen. Automatische Erkennung nutzt das Modell aus der Device Registry. Bei mehreren Anlagen die richtige Installation ausdrücklich wählen.
3. Unter **Messwerte zuordnen** die Funktionsgruppen öffnen. Unter jedem Feld steht der automatische Vorschlag und ob die Entity verfügbar, deaktiviert oder nicht zugeordnet ist.
4. Eine falsche Zuordnung selbst korrigieren: im jeweiligen Feld eine Entity aus der durchsuchbaren Liste auswählen. Namen und IDs sind enthalten. Beispielsweise **Innen** mit `sensor.wohnzimmer_temperatur` statt der NIBE-Climate-Entity belegen. Die Entity muss wirklich existieren und eine Temperatureinheit besitzen. Keine Beispiel-ID ungeprüft übernehmen.
5. Leeres Feld = wieder automatisch zuordnen. **Nicht verwenden** = genau diesen Messwert entfernen. Bei anderen Anbindungsarten **NIBE · Individuell** wählen und die vorhandenen Daten selbst zuordnen. Dieses Profil errät keine Register oder numerischen Betriebsarten.
6. Unter **Bereiche anzeigen** Warmwasser, Lüftung und PV/EVCC automatisch anzeigen lassen oder bewusst **Ausblenden** wählen. Der Status zeigt auch ausgeblendete und nicht erkannte Funktionen. Eine deaktivierte/unavailable Entity zählt als vorhandene Funktion, erscheint aber ohne erfundene Werte.
7. **Einrichtung speichern**. Erst die bestätigte Speicherung übernimmt deine Eingaben. Administratorrechte und ein Dashboard im HA-Speichermodus sind erforderlich. Die Konfiguration liegt in Home Assistant und gilt für dieses Dashboard auf allen Displays. Bestehende Wartungshelfer bleiben erhalten.
8. Nachträgliche Korrekturen erfolgen an derselben Stelle. Bei Fehlern bleiben Eingaben erhalten. Bei einer inzwischen geänderten Einrichtung nichts überschreiben: neu laden und prüfen. YAML-Dashboards und einzelne Karten ohne NIBE-Dashboardstrategie sind weiter lesbar, benötigen aber ihre manuelle YAML-Konfiguration.

### Geräteprofile und Prüfstatus

| Profil | Prüfung | Grenze |
|---|---|---|
| VVM S320 | Entity-Export und vorhandene Anlage VVM S320 / EB101 | Reale Daten und unterstützte Steueroptionen prüfen |
| VVM S325 | Gemeinsame Registerdatei mit VVM S320 | Kein eigener Hardwaretest |
| S1155 / S1255, S1156 / S1256 | Eindeutige Registertitel und Einheiten geprüft | Teilprofile; fehlende Verdichter-/WP-Rollen manuell zuordnen |
| S320 / S325, S2125 | Eindeutige Registertitel und Einheiten geprüft | Kein eigener Hardwaretest; keine ungeprüfte numerische Prioritätsübersetzung |
| NIBE · Individuell | Freie Zuordnung vorhandener HA-Entities | Keine automatische Register-/Statuscode-Semantik |

Ein Modell in der Auswahlliste ist keine Zusage, dass jede Rolle bei jeder Firmware vorhanden ist. Weitere Geräte und andere Anbindungsarten können über manuelle Zuordnung verwendet werden, soweit die nötigen HA-Entities mit passenden Einheiten verfügbar sind. Temperaturdaten werden in °C, Leistung in kW dargestellt; °F/W werden auch in der Historie umgerechnet. Control-Domains und von HA angebotene Modi bleiben obligatorisch. Eine freie Zuordnung öffnet keine zusätzlichen Schreibrechte.

Quellen, geprüft am 14.10.2026: [NIBE-Modellzuordnung](https://github.com/yozik04/nibe/blob/master/nibe/heatpump.py), [Registerdateien](https://github.com/yozik04/nibe/tree/master/nibe/data), [offizielle HA-Dashboard-API](https://github.com/home-assistant/frontend/blob/dev/src/data/lovelace/config/types.ts). Der kompakte [Registeraudit](docs/profile-register-audit.json) enthält die übernommenen eindeutigen Titel-/Einheitentreffer. Kein Laufzeitdownload dieser Daten.

## Prüfgrenzen
Tests führen die ausgelieferte dist-Komponente aus. Echte Home-Assistant-Integration, Mobil-/Tablet-Rendering und reale Hardwareaktionen müssen weiterhin live geprüft werden. Keine gefährlichen Register sind neu bedienbar.

## Video-Fixes 0.9.1
Registry-bestätigte Sensor-/Number-Aliase desselben Registers und Geräts werden zusammengeführt. Bevorzugt wird der aktive kanonische Entity-Typ; Gradminuten bleiben ausschließlich lesbar. Echte Mehrdeutigkeiten zeigen die Kandidaten. EVCC-Smart-Modus und inaktive PV-Aktion sind verständlich beschriftet, die doppelte Modusanzeige ist entfernt. Diagnose zeigt Verdichter-/Prioritäts-/SG-/Alarmdaten sowie elektrische Leistung zum Vergleich. Ein offener Auswertungsbereich bleibt bei Historienaktualisierung offen.

Die Bildschirmaufnahme von 0.9 belegt Darstellung und Bedienung auf einem Android-Smartphone. Sie bestätigt keine neue Liveprüfung des 0.9.1-Builds oder anderer Zielgeräte. SG-Modus 31912 bleibt bei fehlenden Kontakten ein Rohcode; die gefundene Bibliotheks-Code-Tabelle gilt ausdrücklich für S1155/S1255 und wird nicht auf VVM S320 übertragen.

## Prüfumfang 0.10.0
83 Tests einschließlich der ausgelieferten Komponente: Mapping, Ausschluss, Geräteauswahl, W/°F, Speicherung/Rückprüfung, Rechte-/Offline-/Konfliktfälle, Filterwartung, sichere Bedienung und Historie. Build, Syntax und statischer UI-Audit sind geprüft. Neuer Assistent, native Datalist und tatsächliche Speicherung auf deiner Home-Assistant-Instanz benötigen den Livecheck; automatisierte Mocks ersetzen ihn nicht.
