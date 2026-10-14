# 0.9.1
- 69 Tests, Build, Syntaxprüfung und statischer Audit bestanden; neue Version noch nicht live auf HA/Zielgeräten geprüft.
- Fix aus Android-Livevideo: sichere Sensor-/Number-Aliasauflösung für Gradminuten; echte Konflikte behalten explizite Kandidaten.
- EVCC „inactive“/„smart“ beschriften, doppelte Modusanzeige entfernen.
- Diagnosebeschriftung „Verdichter Soll · Soll“ bereinigen, Raumfühlerregelung Ein/Aus und zusätzliche Betriebs-/Leistungsdaten anzeigen.
- Aufgeklappte Auswertung bleibt bei Diagrammaktualisierung geöffnet.
- Keine zusätzliche NIBE-Steuerung; unsichere SG-Codes bleiben technisch bezeichnet.

# 0.9.0
- Gemeinsamer Zeitcursor und beschriftete Messwerttabellen, 6/12/24 Stunden.
- Zeitgewichtete Min-/Max-/Mittel-Auswertung mit Datenabdeckung; Verdichterlaufzeit und beobachtete Starts.
- Historie beim Öffnen, Wiederverbinden und jede Minute bei sichtbaren Charts aktualisieren; alte Kurven bei Fehler behalten, veraltete Antworten verwerfen.
- Ein kanonisches Geräteprofil, sichere config_entry-Zuordnung, keine zufällige Anlagenmischung; manuelle Overrides bei Registryfehler erhalten.
- Live-Datencheck, Warmwasserstatus/Steueroptionen und Lüfterteilverfügbarkeit verbessert.
- Produktprüfungen verwenden das tatsächlich ausgelieferte Bundle.
- Auswahl mehrerer Installationen ist sitzungsbezogen; dauerhafte config_entry_id ist dokumentiert. Echte HA-/Zielgeräteprüfung offen.

# 0.8.1
- Behebt Issue #2: Y-Achsenminimum links unten, Plateau-/Stufenkurven statt diagonaler Rampen.
- Konstante Reihen und letzter Recorder-Zustand bleiben bis zum Zeitraumende sichtbar; unknown/unavailable unterbrechen.
- Beschriftete Zeitmarken und Messwertprüfung aus ungekürzter Historie.
- Warmwasser-/EVCC-Bedienung erhält Optionsprüfung, Offline-/Duplikatschutz und Fehlerrückmeldung.
- 53 Tests plus Build/Syntax und statischer Audit bestanden. HA-Livetest und visuelle Zielgeräteprüfung offen.

# 0.8.0
- Kompaktere Temperatur-, Warmwasser- und Energieansichten; technische Details eingeklappt.
- Anlagenverteiler und klare Wärmeaktivität; präzise Ventilatorbeschriftungen.
- Diagnose als kompakte Zeilen, Einstellungen mit sortiertem Datencheck und expliziten Zuständen.
- Historie mit echten Zeitstempeln, Einheiten, getrennten Hz/kW, Lücken, auswählbaren Reihen und Zeitregler.
- Bestehende Steuerungsallowlist und zweistufige Wartungsbestätigung erhalten.
- Realer HA- und Zielgeräte-Test steht noch aus.

# Changelog

## 0.10.0
- Community-Einrichtungsassistent mit Profil-, Installations- und manueller Entity-Auswahl direkt im Dashboard.
- Dauerhafte Dashboard-Speicherung mit Rückprüfung, Konflikterkennung und klaren Fehlerzuständen.
- Raumtemperatur auch aus frei gewähltem Temperatursensor; W/°F werden konsistent normiert.
- Optionale Warmwasser-/Lüftungs-/EVCC-Bereiche automatisch oder manuell ausgeblendet.
- Weitere registergeprüfte S-Serie-Profile und generisches manuelles Profil; keine geratenen Prioritätscodes.
- Bestehende Filterwartung, Historie und Schreib-Allowlist bleiben erhalten.

## 0.5.0
- neues Geräteschema mit erkennbarer Außen- und Inneneinheit und festen Leitungsanschlüssen
- Heizkreis und Warmwasser auch auf Smartphone und Wall Display dauerhaft sichtbar
- Heiz-/Warmwasserbetrieb anhand der verifizierten NIBE-Priorität 31029
- Live-Wechsel von Betriebsanzeige, aktiven Zweigen und Animation ohne DOM-Neuaufbau
- EVCC-Freigabe, Anforderung und tatsächlicher NIBE-Betrieb eindeutig getrennt
- SG-Ready-Eingänge mit verständlicher Kontaktanzeige und dokumentierter Auswertung
- fehlende Daten erscheinen nicht mehr als ausgeschaltet oder 0 °C

## 0.4.1
- Verdichteranimation im dynamischen Anlagenschema exakt zentriert
- nur der innere Rotor dreht; Rahmen, Werte und Anlagenlayout bleiben ruhig stehen
- Darstellung auf Smartphone, Tablet und Wall Display stabilisiert
- Bedienlogik, Entity-Mapping und Schreibschutz unverändert

## 0.4.0
- responsive Startseite für Smartphone, Tablet und Shelly Wall Display neu geordnet
- eigenes ruhiges Energie-/PV-Board für EVCC und SG Ready
- PV-Aktion, EVCC-Anforderung, Anhebung und SG-Ready-Zustand klar getrennt
- kompaktere Tablet- und Querformat-Darstellung ergänzt
- Live-Aktualisierung aller sichtbaren Kernwerte verbessert

## 0.3.3
- Raum-Sollwertsteuerung aus der normalen Oberfläche entfernt
- gemessene Raum-Isttemperatur bleibt prominent sichtbar
- Register 40207 und Status der Raumfühlerregelung 40203 nur noch in der Diagnose
- irreführende Bezeichnung „Aktuell in NIBE“ entfernt
- Schreibfreigabe für `number.set_value` entfernt

## 0.3.2
- Sollwertänderungen werden erst nach ausdrücklicher Bestätigung übertragen
- aktueller NIBE-Basis-Sollwert bleibt separat sichtbar
- Verwerfen-, Lade-, Erfolgs- und Fehlerzustand ergänzt
- SG-Ready-Anhebung klar vom Basis-Sollwert getrennt

## 0.3.1
- Raum-Isttemperatur und Raum-Solltemperatur eindeutig getrennt
- Raum-Sollwert für Heizkreis S1 verständlich erklärt
- Live-Synchronisierung des Sollwertreglers verbessert

## 0.3.0
- Raum-Sollwert auf NIBE-Register 40207 korrigiert
- Plus/Minus und Slider mit gültigem Ausgangswert und Begrenzung
- optionale EVCC-Erkennung und Modusauswahl ergänzt
- History-Antworten als Objekt oder Array unterstützt
- deaktivierte Sollwertsteuerung verständlich erklärt

## 0.2.0
- dynamisches Anlagenbild und neue responsive Übersicht
- aktueller VVM-S320-Export vom 04.10.2026 eingearbeitet
- Datencheck für deaktivierte und fehlende Entities
- lokale 24-h-SVG-Charts
- Raum-Sollwert mit expliziter Service-Allowlist
- Warmwassermodus nur bei tatsächlich angebotenen Modi
# 0.6.0

- ERS S40-400 mit getrennten dynamischen Luftwegen und Livewerten für Abluft GQ2 / Zuluft GQ3.
- Filterwartung über ausdrücklich zugeordneten HA-Datumshelfer, Kalenderintervall und zweistufige Bestätigung.
- Kein ungeprüftes Schreiben von NIBE-Lüfter-/Filterregistern; Automatik-/Stufenbedienung bleibt bis zum Nachweis gesperrt.
- Zusätzliche Tests für Datum, Schaltjahr, Zeitzone und Bestätigung.

# 0.7.0

- Zwei Einstiegskacheln und getrennte Wärmepumpen-/Lüftungsansichten.
- Wartungsdatum und Monatsintervall direkt im Lüftungsbereich einrichten; nach zweiter Bestätigung werden erforderliche HA-Helfer angelegt und dauerhaft genutzt.
- Bestehende Datumsmappings bleiben unterstützt. Keine NIBE-Installateurwerte werden geschrieben.
- 33 Tests, Build und Syntaxprüfung; reales HA-/Browserlayout noch nicht geprüft.

