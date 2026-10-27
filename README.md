# ECHTKOSTEN

Einfache, statische Website für nachvollziehbare Kostenberechnungen. Die Seite benötigt keinen Build-Schritt und keine externen JavaScript-Dienste.

## Lokal ansehen

Öffne index.html in einem Browser. styles.css und script.js liegen im selben Ordner.

## Rechner

Der allgemeine Rechner summiert einmalige Kosten, monatliche und jährliche Kosten über die gewählte Laufzeit. Der Rabatt wird wie bisher nur auf einmalige Kosten und Zusatzkosten angewendet. Leere Betragsfelder entsprechen 0 €.

Der Autorechner berechnet die Kreditrate mit einer monatlichen Annuität. Der effektive Gesamtaufwand über die Besitzzeit setzt sich zusammen aus:

- Wertverlust: Kaufpreis minus geschätzter Verkaufspreis
- Zinsen, die während der Besitzzeit anfallen
- Versicherung, Kfz-Steuer, Wartung und Kraftstoff- oder Stromkosten

Die Anzahlung und die Tilgung werden nicht ein zweites Mal zu den Kosten addiert. Die Rate und die Restschuld am Ende der Besitzzeit werden separat angezeigt. Die Kfz-Steuer und die übrigen jährlichen Beträge gibt der Nutzer selbst ein; Kraftstoff- und Strompreise sowie Wiederverkaufswert sind Schätzungen.

## Berechnungen prüfen

Mit einer aktuellen Node.js-Version im Projektordner ausführen: node test/calculators.test.js

## Vor einer Veröffentlichung

GitHub Pages ist derzeit nicht Teil dieses Entwurfs. Sobald die endgültige Webadresse feststeht, sollte die Website passende Canonical- und Sitemap-Angaben erhalten. Vor dem Livegang müssen außerdem Impressum und Datenschutzhinweise mit den echten Betreiberangaben ergänzt werden. Partner- oder Werbeangebote sollen erst mit tatsächlichen Anbietern und klarer Kennzeichnung erscheinen.
