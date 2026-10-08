# NIBE Control — Design System

## North Star
Eine ruhige technische Gebäudeautomation mit der Verständlichkeit einer guten Consumer-App. Der Anlagenfluss ist die visuelle Signatur: Außenluft → Wärmepumpe → System → Heizkreis/Warmwasser.

## Visual language
- Hintergrund und Karten kommen ausschließlich aus Home-Assistant-Themevariablen.
- Funktionsfarben: Wärmepumpen-Grün `#287f75`, Heizfluss `#dc704e`, Wasser `#3c7d9d`, Solarstatus `#c89538`, aktiver Energiepfad `#4fa57b`.
- Zahlen sind kompakt, kontrastreich und tabellarisch lesbar; technische Kürzel bleiben sekundär sichtbar.
- Runde Ecken sind funktional abgestuft: 22 px Anlagenbild, 18 px Hauptkarten, 14 px Messwerte.

## Layout
- Ab 0.7: Einstieg mit zwei gleichwertigen Anlagenkacheln. Wärmepumpe und Lüftung besitzen getrennte Inhaltsbereiche; die Kacheln bleiben als Wechselnavigation sichtbar. Der Einstieg zeigt keine lange kombinierte Detailseite. Verläufe/Datencheck/Diagnose gehören zur Wärmepumpe.
- Desktop: Anlagenbild über zwei kompakten Funktionskarten und einem breiteren Energie-/PV-Board; sechs Messwerte bleiben darunter.
- Tablet und Shelly Wall Display: zwei Spalten, Energie-/PV-Board über volle Breite, reduzierte vertikale Abstände bei geringer Displayhöhe.
- Smartphone: einspaltige Hauptkarten, Messwerte im 2er-Raster, vereinfachtes Anlagenbild und dreiteilige EVCC-/SG-Statuskette.
- Vier klare Modi: Übersicht, Verläufe, Datencheck, Diagnose.

## Anlagenbild 0.5
Die Signatur ist ein erkennbares Gerätepaar: Außenmodul mit festem Ventilatorrahmen und NIBE-Innenmodul. Beide Gehäuse sind 88 px hoch. Leitungen liegen in einem eigenen Grid-Segment an Y=36/52 px und enden exakt an den Gehäusekanten; keine viewportabhängigen Prozentpositionen. Heizkreis und Speicher stehen immer darunter, auch mobil. Aktivität wird durch Text und zurückhaltende Umrandung sichtbar, niemals nur durch Farbe.

## Motion
Nur der innere, exakt zentrierte Verdichterrotor und ein aktiver Wärmefluss bewegen sich. Rahmen, Messwert und Anlagenraster bleiben auch im Betrieb vollständig ruhig. `prefers-reduced-motion` deaktiviert alle Animationen.

## Safety
Bedienung ist kein Nebenprodukt schreibbarer Entities. Der lokale Raum-Sollwert bleibt read-only; nur von `water_heater` tatsächlich angebotene Modi und der vorhandene EVCC-Modus sind freigegeben.

## Energy board
Das Energie-/PV-Board trennt vier Aussagen: elektrische Wärmepumpenleistung, EVCC-Aktivierung, EVCC-Anforderung und SG-Ready-Zustand. PV-Aktion und Anhebung werden nur angezeigt, wenn die entsprechenden EVCC-Entitäten existieren. Ein allgemeiner PV-Überschusswert wird niemals aus einem unbekannten Sensor abgeleitet.

## Runtime mapping
Die normativen Farben werden als `--nc-*` Variablen im Root der Komponente definiert. Oberflächen, Text, Fehler- und Fokusfarben erben aus dem aktiven Home-Assistant-Theme.
Runtime-CSS bleibt kanonisch (Token-Modell B). `plantStyles()` konsumiert die bestehenden semantischen Variablen, ohne neue Farbpalette oder externe Schriftdateien. Geräteschrift erbt die HA-Systemschrift, Messwerte verwenden tabellarische Ziffern.
## Lüftung 0.6
Die ERS S40-400 wird als Rotationswärmetauscher mit zwei getrennten Luftwegen ergänzt. Blau nutzt `--nc-blue` für Außenluft/Zuluft, warm nutzt `--nc-warm` für Abluft/Fortluft. Der Rotor bleibt ohne Status statisch; bewegte Luftwege benötigen echte Ventilatorwerte. Mobil stehen die Wege untereinander; bestehende Heizungs-/Energiekarten behalten ihre Geometrie. Wartung verwendet einen nativen modalen Dialog mit deutschen Beschriftungen und den vorhandenen Themevariablen.

## Filtereinrichtung 0.7
Eingeklappte Einstellungen im Lüftungsbereich. Native Zahl- und Datumeingabe: Plattform-eigene Kalendergeometrie und Sprache sind akzeptiert; Labels, Fehler, Datumsausgabe und Bestätigung sind Deutsch. Die endgültige Bestätigung nutzt denselben Wartungsdialog wie der Filterwechsel. Intervall und Wechseldatum werden in HA-Helfern gespeichert, nicht in Browserdaten.
