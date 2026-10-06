# Changelog
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
