# Changelog
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
