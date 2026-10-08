# NIBE Control 0.5.0

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
# Lüftung und Filterwartung ab 0.6.0

ERS S40-400: GQ2 (30136) zeigt den Abluftventilator, GQ3 (30137) den Zuluftventilator. Die zwei schematischen Luftwege bewegen sich nur bei gemeldeter Ventilatoraktivität. Der Rotationswärmetauscher bleibt ohne belegten Rotorstatus statisch. Lufttemperaturen, Wirkungsgrad und Bypass werden nicht aus Außen-/Raumtemperatur geschätzt. Lüftermodus 31038 bleibt ein Rohwert in der Diagnose.

## Filterwechseldatum einrichten

1. Home Assistant → Einstellungen → Geräte & Dienste → Helfer → Helfer erstellen → Datum und/oder Uhrzeit.
2. Name „NIBE Lüftung Filterwechsel“, nur **Datum** aktivieren. Die tatsächlich erzeugte Entity-ID kopieren.
3. Das Datum des letzten echten Filterwechsels im Helfer einstellen. Ist es unbekannt, keine historische Wartung erfinden.
4. Dashboard → Bearbeiten → Rohkonfigurationseditor. In der bestehenden `strategy` ergänzen (andere Einstellungen behalten):

```yaml
strategy:
  type: custom:nibe-control
  ventilation:
    filter_date_entity: input_datetime.nibe_luftung_filterwechsel
    filter_interval_months: 3
```

Die Entity-ID ist ein **Beispiel** und muss mit deinem Helfer übereinstimmen. `3` Monate ist ebenfalls ein Beispiel: Trage das an deiner NIBE eingestellte Intervall ein. Die acht exportierten Filterintervallregister sind noch nicht eindeutig einem ERS-Modul zugeordnet; NIBE Control übernimmt daher keinen ungeprüften Wert. Bei einer direkt eingebauten Karte liegt `ventilation` neben `type: custom:nibe-control-card`.

5. Speichern und Dashboard neu laden. Die Wartung zeigt letzten Wechsel, nächsten Termin und verbleibende/überfällige Tage.
6. Nach dem tatsächlichen Tausch „Filter gewechselt“ drücken. Erst „Ja, Filterwechsel speichern“ im zweiten Dialog schreibt das heutige Datum in den zugeordneten Helfer. „Abbrechen“ und Escape speichern nichts. Das Datum wird nach der Home-Assistant-Zeitzone bestimmt und ist auf allen Displays gleich.

Der Button aktualisiert die Wartungsanzeige; er quittiert **keine NIBE-Filtermeldung**. Ohne verfügbaren Datumshelfer bleibt er deaktiviert. Monatliche Termine werden bei kurzen Monaten auf deren letzten Tag begrenzt.

## Noch nicht freigegebene Lüftungssteuerung

Der Export enthält keinen belegten Stufenwahl-/Automatikbefehl. Die `number.exhaust_air_fan_speed_*`-Entitäten konfigurieren feste Stufen und sind keine temporäre Stufenwahl. Deshalb erzeugt diese Version keine Lüfterbedienung und verändert keine Einregulierung. Automatik-/Stufensteuerung folgt erst mit einer verifizierten Datenquelle.

## Verifizierung 0.6.0

Build, Syntaxprüfung und automatisierte Tests prüfen Kalendergrenzen, fehlende Daten, Zeitzone und die zweistufige Datumsänderung. Eine reale HA-Installation und geräteübergreifende Browserdarstellung sind damit noch nicht nachgewiesen.

