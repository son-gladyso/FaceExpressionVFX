# FaceExpressionVFX v3.11

[简体中文](README.zh-CN.md) · [English](../../README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [繁體中文](README.zh-TW.md)

**Betrachte Schätzungen von Gesichtsbewegungen zusammen mit den Gründen, ihnen weniger zu vertrauen.**

FaceExpressionVFX ist eine experimentelle Arbeitsumgebung im Browser für Entwickler, die die von FACS inspirierte Geometrie von Gesichtsaktionseinheiten (AU) untersuchen. Die Kameraverarbeitung bleibt lokal; Qualitätsprüfungen, Kalibrierung und Unsicherheit machen die Verarbeitungskette nachvollziehbar. Version 3.11 liefert Schätzungen beobachtbarer Bewegungen und deren Unsicherheit. Sie gibt keine Aussagen zu Identität, Absicht, Wahrheitsgehalt, Aufrichtigkeit oder Persönlichkeit und keine psychologischen oder medizinischen Diagnosen aus.

[Erstes Experiment](#first-experiment) · [Lokal ausführen](#run-and-verify) · [Verarbeitungskette](#v311-algorithm-pipeline) · [Häufige Fragen](#common-questions) · [Mitwirken](#help-improve-the-experiment)

<a id="what-you-can-explore"></a>
## Was du erkunden kannst

Demos für Gesichtsbewegungen zeigen häufig einen Zahlenwert, ohne zu erklären, wann er unzuverlässig wird. Dieses Projekt zeigt Qualitätsprüfungen und Unsicherheit direkt neben den Bewegungsschätzungen.

- Zusammenfassungen von Bewegungen der Augenbrauen, Augen, Wangen, Nase, Lippen und des Mundes untersuchen.
- Beobachten, wie Kalibrierung, Kopfhaltung und Bildqualität die Ausgabe beeinflussen.
- Die deterministischen Regeln und Tests erkunden, bevor ein optionales Modell hinzugefügt wird.
- Den Verlauf nur dann aufzeichnen, wenn du dich dafür entscheidest, und ihn anschließend als lokalen Download exportieren.

Das Projekt richtet sich an Entwickler und Experimentierende, die beobachtbare Gesichtsbewegungen und die Grenzen einer geometriebasierten Verarbeitungskette untersuchen möchten. Es leitet nicht ab, was eine Person fühlt oder beabsichtigt.

<a id="first-experiment"></a>
## Erstes Experiment

Starte die Anwendung mit [Ausführen und überprüfen](#run-and-verify). Beginne mit einem gut beleuchteten, neutralen Gesicht, folge dem Kalibrierungsablauf und versuche dann eine kleine sichtbare Bewegung, etwa die Augenbrauen anzuheben oder den Mund zu öffnen. Beobachte neben den Bewegungswerten auch die Qualitäts- und Unsicherheitsanzeigen.

Ein sinnvoller Vergleich ist eine klare Frontalansicht gegenüber einer schwierigeren Ansicht. Bilder geringer Qualität sollten als eingeschränkte Evidenz behandelt werden, nicht als Grundlage für stärkere Schlussfolgerungen über ein Gesicht. Die dokumentierte Verarbeitungskette kann die Inferenz geringer gewichten oder pausieren.

Eine echte Kameraaufnahme ist hier noch nicht eingebettet. Die mitgelieferte synthetische Auswertung prüft Testverträge, nicht die Genauigkeit bei Videos von Menschen.

<a id="three-useful-things-to-compare"></a>
### Drei nützliche Vergleiche

| Experiment | Beobachten | Nicht daraus schließen |
| --- | --- | --- |
| Neutrales Gesicht, dann eine kleine Bewegung der Augenbrauen oder des Mundes | Bewegungsschätzungen und ihre Intervalle | Dass ein Wert Emotionen, Aufrichtigkeit oder Absichten misst. |
| Frontalansicht, dann eine schwierigere Kopfhaltung oder Beleuchtung | Qualitätswert, Konfidenz und Verhalten beim Pausieren oder Herabgewichten | Dass ein schlechtes Bild stärkere Evidenz über die Person liefert. |
| Ausdrücklich eine kurze Aufzeichnung starten und dann exportieren | Lokalen Verlauf und JSON/CSV-Ausgabe | Dass der Export eine validierte Diagnose oder ein Genauigkeitsbericht für reale Bedingungen ist. |

Die Oberfläche enthält einen Umschalter für Chinesisch/Englisch, einen Verlauf und Bedienelemente für den JSON/CSV-Export. Eine Aufzeichnung ist eine bewusste Handlung und keine Voraussetzung dafür, die Live-Verarbeitung zu untersuchen.

<a id="v311-algorithm-pipeline"></a>
## Algorithmische Verarbeitungskette in v3.11

1. MediaPipe liefert mindestens 468 normalisierte Gesichtslandmarken.
2. Eine Bildqualitätsprüfung bewertet die Vollständigkeit der Landmarken, Gesichtsgrenzen und -größe, Kopfhaltung, Beleuchtung, Kontrast, Clipping, Schärfe sowie einen Näherungsindikator für Sichtbarkeit und Blendung im Augenbereich.
3. Bilder werden zugelassen, in ihrer Konfidenz geringer gewichtet oder pausiert. Pausierte Bilder können weder die AU-Inferenz noch die persönliche Kalibrierung aktualisieren.
4. Eine robuste persönliche Referenz verwendet Mediane und die mediane absolute Abweichung (MAD), verwirft minderwertige Bilder und Ausreißer und wendet nur bei ruhigen, hochwertigen Bildern eine langsame, begrenzte Driftanpassung an.
5. Die Kompensation der Kopfhaltung und auf das Gesicht normierte Abstände verringern vor der AU-Berechnung die Einflüsse der Haltung und der stabilen, personenspezifischen Gesichtsgeometrie.
6. Jede AU liefert `value`, `lower`, `upper`, `confidence` und eine anatomische `region`.
7. Ein bayesscher Zeitfilter mit expliziter Zustandsdauer ersetzt die auf Bildanzahlen beruhende Hysterese und gibt die Posterior-Konfidenz sowie die normalisierte Unsicherheit aus.
8. Aus den AU-Schätzungen werden zwölf Zusammenfassungen beobachtbarer Bewegungen mit fortgepflanzten Intervallen abgeleitet.

Ein trainiertes Modell ist nicht enthalten. Ein optionaler AU-Anbieter wird nur aktiviert, wenn seine Metadaten Name, Version, Lizenz, Herkunft der Trainingsdaten, AU-Label-Zuordnung und Auswertungsmetriken enthalten. Sein Beitrag wird nach Qualität gewichtet und begrenzt; die deterministischen Geometrieregeln bleiben die Rückfalllösung.

<a id="run-and-verify"></a>
## Ausführen und überprüfen

Bereite Node.js/npm, einen modernen Browser mit Kameraunterstützung und eine funktionierende Kamera vor. Führe die Befehle im Stammverzeichnis des Repositorys aus. Verwende für den Kamerazugriff `localhost` oder HTTPS und erlaube Netzwerkzugriff für die MediaPipe-CDN-Skripte und Webfonts. Lokale Bildverarbeitung bedeutet nicht, dass der erste Start vollständig offline erfolgt.

```powershell
npm install
npm run check
npm start
```

`npm start` startet einen statischen Server auf Port 8080 und fordert den Browser auf, ihn zu öffnen. Öffne bei Bedarf selbst `http://localhost:8080`. Der Befehl verwendet `npx http-server`, wodurch der Server bei der ersten Verwendung heruntergeladen werden kann.

**Erste erfolgreiche Aktion:** Untersuche das Live-Panel für Kalibrierung und Qualität, führe eine sichtbare Bewegung aus und vergleiche ihre Schätzung mit der Unsicherheitsanzeige. Bestandene Kommandozeilenprüfungen ersetzen diesen Kameratest nicht.

`npm run check` führt Unit- und Vertragstests, eine deterministische AU-Metrik-Test-Fixture, ESLint sowie statische Release-Prüfungen aus. Die Auswertungs-CLI meldet für jede AU Präzision, Recall, F1 und Falsch-Positiv-Rate sowie Zusammenfassungen für separat zurückgehaltene Testpersonen:

```powershell
node scripts/evaluate-au.mjs evaluation/fixtures/synthetic-au-eval.json
```

Die mitgelieferten Vektoren sind synthetische Vertragstests, keine Belege für Genauigkeit unter realen Bedingungen. Die Anforderungen an das feste Video-Manifest stehen in [evaluation/README.md](../../evaluation/README.md). Für v3.11 lag kein weiterverteilbarer, rechtmäßig annotierter Videodatensatz mit Menschen vor. Diese Version erhebt daher weder einen Anspruch auf Genauigkeit bei realen Videos noch auf personenübergreifende Generalisierung.

<a id="main-modules"></a>
## Zentrale Module

- `face-quality.js` — Bildqualitätsprüfungen und AU-Konfidenzintervalle
- `face-au-detector.js` — robuste Kalibrierung, Haltungskompensation und deterministische AU-Geometrie
- `face-temporal.js` — bayesscher Zustandsfilter mit expliziter Zustandsdauer
- `face-observables.js` — Zusammenfassungen direkt beobachtbarer Bewegungen
- `face-model-adapter.js` — optionaler Klassifikator mit Herkunftsprüfung und regelbasierter Rückfalllösung
- `scripts/evaluate-au.mjs` — AU-Metriken mit festem Manifest und Berichte mit zurückgehaltenen Testpersonen

<a id="common-questions"></a>
## Häufige Fragen

**Ist das ein Emotionsdetektor?** Nein. Die Ausgaben sind Näherungsgrößen für Geometrie und Bewegung, keine Bezeichnungen psychischer Zustände.

**Warum pausiert die Inferenz oder sinkt die Konfidenz?** Die Qualitätsprüfung berücksichtigt Haltung, Sichtbarkeit, Beleuchtung und weitere Bildbedingungen. Prüfe die Qualitätsanzeigen und verbessere die Ansicht, statt ein pausiertes Ergebnis als negativen Befund über die Person zu interpretieren.

**Ist ein trainiertes AU-Modell enthalten?** Nein. Die mitgelieferte Verarbeitungskette verwendet deterministische Geometrie. Optionale Anbieter benötigen Metadaten sowie Angaben zu Herkunft, Lizenzierung und Auswertung, bevor sie beitragen können.

**Beweist die synthetische Auswertung die Genauigkeit mit meiner Kamera?** Nein. Sie überprüft Metrik- und Testverträge. Für die Validierung mit realen Videos sind ein geeigneter, rechtmäßig annotierter Auswertungsdatensatz und das Verfahren mit festem Manifest aus [evaluation/README.md](../../evaluation/README.md) erforderlich.

**Wo befindet sich der aufgezeichnete Verlauf?** Nach dem Start der Aufzeichnung in der lokalen IndexedDB des Browsers. Exporte sind lokale Downloads. Behandle Aufzeichnungen und Exporte als personenbezogene Daten, auch wenn sie nicht automatisch hochgeladen werden.

<a id="privacy-and-limits"></a>
## Datenschutz und Grenzen

Kamerabilder werden im Browser verarbeitet. Dieses Projekt lädt nichts hoch. Ein Verlauf wird erst aufgezeichnet, nachdem der Nutzer die Aufzeichnung gestartet hat, und verbleibt in der lokalen IndexedDB; Exporte sind ausdrücklich ausgelöste lokale Downloads. Verwende FaceExpressionVFX nicht für Identifizierung, Überwachung, Gesundheitsversorgung, Beschäftigung, Versicherungen, Polizeiarbeit, Disziplinarmaßnahmen im Bildungsbereich oder andere Entscheidungen mit erheblichen Auswirkungen. Siehe [PRIVACY.md](../../PRIVACY.md).

Unter MIT-Lizenz. Bibliotheken von Drittanbietern und etwaige zukünftige Datensätze oder Modelle behalten ihre eigenen Lizenzen.

<a id="help-improve-the-experiment"></a>
## Hilf mit, das Experiment zu verbessern

Beiträge sind in Bereichen willkommen, in denen sich das Ergebnis überprüfen lässt:

- Grenzfälle bei Bildqualität und Kalibrierung.
- Barrierefreie Beschriftungen, klarere Erklärungen der Unsicherheit und verbesserte Übersetzungen.
- Regressionstests für AU-Geometrie und zeitliches Verhalten.
- Reproduzierbare Auswertungswerkzeuge mit angemessen lizenzierten Daten und entsprechender Einwilligung.

| Beitragsbereich | Dateien für den Einstieg | Nützliche Evidenz |
| --- | --- | --- |
| Grenzfälle der Bildqualität | `face-quality.js`, `face-policies.js` | Ein gezielter Regressionsfall und das erwartete Verhalten beim Zulassen, Herabgewichten oder Pausieren. |
| Kalibrierung oder AU-Geometrie | `face-au-detector.js`, `face-temporal.js` | Eine deterministische Eingabesequenz und ausdrücklich festgelegte Grenzen der erwarteten Ausgabe. |
| Sprache und Verständlichkeit der Oberfläche | `face-i18n.js`, `index.html` | Beide Sprachzustände und eine Erklärung, die die Unsicherheit wahrt. |
| Auswertungswerkzeuge | `scripts/evaluate-au.mjs`, `evaluation/README.md` | Manifest- und Schemaprüfungen; synthetische Evidenz und Evidenz aus realen Videos getrennt kennzeichnen. |

Beginne mit dem betreffenden Modul und `npm run check`. Erläutere in einem [Pull Request](https://github.com/son-gladyso/FaceExpressionVFX/pulls) das Problem, die Evidenz, die tatsächlich ausgeführten Tests und die noch nicht validierten Aspekte. Besprich größere Änderungen vor der Umsetzung in einem [Issue](https://github.com/son-gladyso/FaceExpressionVFX/issues).

Steuere keine privaten Gesichtsaufzeichnungen, biometrischen Einbettungen, Modellgewichte oder Datensätze bei, wenn dir die Rechte und Genehmigungen zum Teilen fehlen. Bewahre die Unterscheidung zwischen beobachtbarer Bewegung und Aussagen über Identität, Emotionen, Absicht oder Gesundheit.
