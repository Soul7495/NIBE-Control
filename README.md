# NIBE Control 0.8.0

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
- gemessene Raumtemperatur aus der NIBE-Climate-Entity
- optionale EVCC-Status- und Modusanzeige
- eigenes Energie-/PV-Board für EVCC-Anforderung, PV-Aktion, Anhebung und SG Ready
- responsive Layouts für Smartphone, Tablet und Shelly Wall Display
- Light/Dark Theme und reduzierte Bewegung

## Installation
1. Repository auf GitHub veröffentlichen.
2. In HACS unter **Frontend → Benutzerdefinierte Repositorys** die Repository-URL als Kategorie **Dashboard** hinzufügen.
3. NIBE Control installieren und Home Assistant/Browser neu laden.
4. **Einstellungen → Dashboards → Dashboard hinzufügen → Community-Dashboards → NIBE Control**.

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

## Anlagenwahl und Filterwartung ab 0.8.0

Der Einstieg zeigt zwei Kacheln: **Wärmepumpe** und **Lüftung**. Wähle eine Anlage; die andere Detailansicht bleibt verborgen. Die Kacheln zeigen Livewerte und erlauben jederzeit den Wechsel. Heizungsdiagramme und Diagnose bleiben in der Wärmepumpenansicht erhalten.

### Einrichtung direkt im Dashboard

1. Lüftung öffnen → **Filterwartung einrichten / ändern**.
2. Das an deiner NIBE eingestellte Intervall in ganzen Monaten (1–24) eintragen. Die acht vorhandenen Filterregister werden weiterhin nicht ungeprüft zugeordnet.
3. Das Datum des letzten tatsächlichen Filterwechsels eintragen. Ist es unbekannt, erst nach dem nächsten echten Tausch einrichten.
4. **Einstellungen übernehmen** → Angaben prüfen → **Ja, Einstellungen speichern**. Erst die zweite Bestätigung speichert.
5. Bei erstmaliger Einrichtung erstellt HA einen Datumshelfer und einen Zahlenhelfer. Administratorrechte und die HA-Integrationen input_datetime/input_number müssen verfügbar sein. Der Helfername enthält die NIBE-Integrationskennung, damit mehrere Installationen getrennt bleiben. Die Daten überleben Neustarts und stehen auf allen Displays zur Verfügung.
6. Nach späterem Tausch **Filter gewechselt** wählen und im zweiten Dialog bestätigen.

Die Wartung zeigt letztes Datum, nächste Fälligkeit und verbleibende/überfällige Tage. Monatsenden und HA-Zeitzone werden berücksichtigt. Es wird keine NIBE-Filtermeldung quittiert und kein NIBE-Intervall verändert. Wenn ein Speicherschritt fehlschlägt, zeigt der Dialog einen Fehler; bereits angelegte Helfer bleiben erhalten. Eingaben prüfen und erneut speichern. Bei mehreren gleichnamigen Helfern ist eine explizite Zuordnung nötig. Helfer nicht umbenennen, solange sie nur automatisch anhand ihres ursprünglichen Namens zugeordnet sind.

### Bestehende Helfer / manuelle Zuordnung

Die bisherige `ventilation.filter_date_entity`-Konfiguration bleibt gültig. Optional kann in derselben Konfiguration `filter_interval_entity` auf einen vorhandenen input_number-Helfer zeigen (min 1, max 24, step 1). Ohne diesen Helfer bleibt das alte `filter_interval_months` lesbar; bei Einrichtung über die Oberfläche wird ein dauerhafter Intervallhelfer genutzt. Für neu angelegte Helfer sind keine YAML-Einträge erforderlich.

### Lüftungsdaten und Grenzen

ERS S40-400: GQ2 / Register 30136 ist Abluft, GQ3 / 30137 Zuluft. Luftwege bewegen sich nur bei gemeldeter Aktivität. Rotorbetrieb, Lufttemperaturen und Wirkungsgrad werden nicht geschätzt. Modus 31038 bleibt Diagnose-Rohwert. Lüftersteuerung samt Rückkehr zur Normalregelung ist weiterhin gesperrt: Die vorhandene Integration liefert keinen vollständigen belegten Steuerweg. Fest konfigurierte Stufenprozente bleiben unangetastet.

### Verifizierung

37 automatisierte Tests, Build, Syntaxprüfung und statischer UI-Audit bestanden. Echte HA-Helfererstellung, Tastaturbedienung im Browser und visuelle Darstellung auf Smartphone/Tablet/Wall Display müssen noch live geprüft werden.

## UI 0.8
Kompakte Übersicht, Warmwasserbedienung aufklappbar, technische Details eingeklappt. Verläufe trennen Hz und kW und verwenden echte Zeitstempel. Diagramme antippen oder den Zeitregler nutzen; Legenden schalten einzelne Reihen. Einstellungen enthält den Datencheck. Lüfterwerte sind Ventilatorprozente und kein gemessener Volumenstrom. Liveprüfung in HA und auf Zielgeräten steht noch aus.
