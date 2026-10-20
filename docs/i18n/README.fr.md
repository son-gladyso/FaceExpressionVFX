# FaceExpressionVFX v3.11

[简体中文](README.zh-CN.md) · [English](../../README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [繁體中文](README.zh-TW.md)

**Consultez les estimations des mouvements du visage avec les raisons de leur accorder moins de confiance.**

FaceExpressionVFX est un atelier expérimental dans le navigateur, destiné aux développeurs qui explorent la géométrie des unités d'action faciale (AU) inspirée du FACS. Le traitement de la caméra reste local ; les contrôles de qualité, l'étalonnage et l'incertitude permettent d'inspecter la chaîne de traitement. La version 3.11 fournit des estimations de mouvements observables et leur incertitude ; elle ne produit aucun résultat sur l'identité, l'intention, la véracité, la sincérité ou la personnalité, ni aucun diagnostic psychologique ou médical.

[Première expérience](#first-experiment) · [Exécution locale](#run-and-verify) · [Chaîne de traitement](#v311-algorithm-pipeline) · [Questions fréquentes](#common-questions) · [Contribuer](#help-improve-the-experiment)

<a id="what-you-can-explore"></a>
## Ce que vous pouvez explorer

Les démonstrations de mouvements du visage affichent souvent un nombre sans expliquer dans quelles conditions il devient peu fiable. Ce projet rend visibles les contrôles de qualité et l'incertitude à côté des estimations de mouvement.

- Examiner les résumés des mouvements des sourcils, des yeux, des joues, du nez, des lèvres et de la bouche.
- Observer les effets de l'étalonnage, de la pose de la tête et de la qualité des images sur le résultat.
- Explorer les règles déterministes et les tests avant d'ajouter un modèle facultatif.
- Enregistrer l'historique uniquement lorsque vous le décidez, puis l'exporter par téléchargement local.

Ce projet s'adresse aux développeurs et aux expérimentateurs qui souhaitent étudier les mouvements observables du visage et les limites d'une chaîne de traitement fondée sur la géométrie. Il ne déduit pas ce qu'une personne ressent ou a l'intention de faire.

<a id="first-experiment"></a>
## Première expérience

Suivez la section [Exécution et vérification](#run-and-verify) pour démarrer l'application. Commencez avec un visage neutre et bien éclairé, suivez la procédure d'étalonnage, puis essayez un petit mouvement visible, comme lever les sourcils ou ouvrir la bouche. Observez les indicateurs de qualité et d'incertitude, ainsi que les valeurs de mouvement.

Il est utile de comparer une vue frontale nette à une vue plus difficile. Les images de faible qualité doivent être considérées comme des éléments limités, et non comme une base pour tirer des conclusions plus fortes sur un visage. La chaîne documentée peut réduire le poids de l'inférence ou la suspendre.

Aucun enregistrement provenant d'une véritable caméra n'est encore intégré ici. L'évaluation synthétique fournie vérifie les contrats de test, et non l'exactitude sur des vidéos de personnes.

<a id="three-useful-things-to-compare"></a>
### Trois comparaisons utiles

| Expérience | À observer | Ne pas en conclure |
| --- | --- | --- |
| Visage neutre, puis petit mouvement des sourcils ou de la bouche | Estimations de mouvement et leurs intervalles | Qu'une valeur mesure l'émotion, la sincérité ou l'intention. |
| Vue frontale, puis pose ou éclairage plus difficiles | Score de qualité, confiance et comportement de suspension ou de réduction de poids | Qu'une mauvaise image apporte des éléments plus solides sur la personne. |
| Démarrer explicitement un bref enregistrement, puis l'exporter | Historique local et sortie JSON/CSV | Que l'export est un diagnostic validé ou un rapport d'exactitude en conditions réelles. |

L'interface comprend un sélecteur chinois/anglais, un historique et des commandes d'export JSON/CSV. L'enregistrement est une action délibérée, et non un préalable à l'inspection de la chaîne en direct.

<a id="v311-algorithm-pipeline"></a>
## Chaîne algorithmique de la version 3.11

1. MediaPipe fournit 468 points de repère faciaux normalisés ou plus.
2. Un contrôle de qualité des images évalue l'intégrité des points de repère, les limites et l'échelle du visage, la pose de la tête, l'éclairage, le contraste, l'écrêtage, la netteté et un indicateur indirect de visibilité ou de reflets dans la région des yeux.
3. Les images sont acceptées, voient leur poids de confiance réduit ou sont suspendues. Les images suspendues ne peuvent mettre à jour ni l'inférence des AU ni l'étalonnage personnel.
4. Une référence personnelle robuste utilise les médianes et l'écart absolu médian (MAD), rejette les images de faible qualité ou aberrantes, et n'applique qu'une dérive lente et bornée aux images de bonne qualité avec peu de mouvement.
5. La compensation de la pose de la tête et les distances normalisées par rapport au visage réduisent les effets de la pose et de la géométrie stable propre à chaque personne avant le calcul des AU.
6. Chaque AU renvoie `value`, `lower`, `upper`, `confidence` et une `region` anatomique.
7. Un filtre temporel bayésien à durée explicite remplace l'hystérésis fondée sur le nombre d'images et fournit la confiance a posteriori ainsi que l'incertitude normalisée.
8. Douze résumés de mouvements observables sont dérivés des estimations des AU, avec propagation des intervalles.

Aucun modèle entraîné n'est fourni. Un fournisseur d'AU facultatif n'est activé que si ses métadonnées contiennent son nom, sa version, sa licence, la provenance des données d'entraînement, la correspondance des étiquettes d'AU et les métriques d'évaluation. Sa contribution est pondérée par la qualité et plafonnée ; les règles géométriques déterministes restent la solution de repli.

<a id="run-and-verify"></a>
## Exécution et vérification

Préparez Node.js/npm, un navigateur moderne prenant en charge les caméras et une caméra en état de marche. Exécutez les commandes depuis la racine du dépôt. Utilisez `localhost` ou HTTPS pour accéder à la caméra et autorisez l'accès réseau aux scripts du CDN MediaPipe et aux polices web. Le traitement local des images ne rend pas le premier lancement entièrement utilisable hors ligne.

```powershell
npm install
npm run check
npm start
```

`npm start` démarre un serveur statique sur le port 8080 et demande au navigateur de l'ouvrir. Si nécessaire, ouvrez vous-même `http://localhost:8080`. La commande utilise `npx http-server`, qui peut télécharger le serveur lors de sa première utilisation.

**Première action réussie :** examinez le panneau d'étalonnage et de qualité en direct, effectuez un mouvement visible et comparez son estimation à l'affichage de l'incertitude. La réussite des contrôles en ligne de commande ne remplace pas cette vérification avec la caméra.

`npm run check` exécute les tests unitaires et de contrat, un jeu de test déterministe des métriques d'AU, ESLint et les contrôles statiques de publication. L'interface en ligne de commande d'évaluation fournit, pour chaque AU, la précision, le rappel, F1 et le taux de faux positifs, ainsi que des résumés concernant les sujets réservés à l'évaluation :

```powershell
node scripts/evaluate-au.mjs evaluation/fixtures/synthetic-au-eval.json
```

Les vecteurs fournis sont des tests de contrat synthétiques, pas des preuves d'exactitude en conditions réelles. Consultez [evaluation/README.md](../../evaluation/README.md) pour les exigences du manifeste fixe de vidéos. Aucun jeu de vidéos de personnes redistribuable et légalement annoté n'était disponible pour la version 3.11 ; cette version ne revendique donc ni exactitude sur des vidéos réelles ni généralisation d'une personne à l'autre.

<a id="main-modules"></a>
## Modules principaux

- `face-quality.js` — contrôles des images et intervalles de confiance des AU
- `face-au-detector.js` — étalonnage robuste, compensation de la pose et géométrie déterministe des AU
- `face-temporal.js` — filtre bayésien d'états à durée explicite
- `face-observables.js` — résumés des mouvements directement observables
- `face-model-adapter.js` — classificateur facultatif soumis à des exigences de provenance et repli sur les règles
- `scripts/evaluate-au.mjs` — métriques d'AU sur manifeste fixe et rapports sur les sujets réservés à l'évaluation

<a id="common-questions"></a>
## Questions fréquentes

**Est-ce un détecteur d'émotions ?** Non. Les sorties sont des indicateurs indirects de géométrie et de mouvement, pas des étiquettes d'états mentaux.

**Pourquoi l'inférence se suspend-elle ou la confiance baisse-t-elle ?** Le contrôle de qualité tient compte de la pose, de la visibilité, de l'éclairage et d'autres conditions de l'image. Consultez les indicateurs de qualité et améliorez la vue plutôt que d'interpréter un résultat suspendu comme un constat négatif sur la personne.

**Un modèle d'AU entraîné est-il inclus ?** Non. La chaîne fournie utilise une géométrie déterministe. Les fournisseurs facultatifs doivent présenter des métadonnées et des informations de provenance, de licence et d'évaluation avant de pouvoir contribuer.

**L'évaluation synthétique prouve-t-elle l'exactitude avec ma caméra ?** Non. Elle vérifie les contrats des métriques et des tests. La validation sur vidéo réelle exige un jeu d'évaluation approprié et légalement annoté, ainsi que la procédure à manifeste fixe décrite dans [evaluation/README.md](../../evaluation/README.md).

**Où se trouve l'historique enregistré ?** Dans l'IndexedDB local du navigateur, après le démarrage de l'enregistrement. Les exports sont des téléchargements locaux ; traitez les enregistrements et les exports comme des données personnelles, même s'ils ne sont pas téléversés automatiquement.

<a id="privacy-and-limits"></a>
## Confidentialité et limites

Les images de la caméra sont traitées dans le navigateur. Ce projet ne téléverse rien. L'historique n'est enregistré qu'après le démarrage de l'enregistrement par l'utilisateur et reste dans l'IndexedDB local ; les exports sont des téléchargements locaux explicites. N'utilisez pas FaceExpressionVFX pour l'identification, la surveillance, les soins de santé, l'emploi, les assurances, les activités policières, les sanctions disciplinaires dans l'éducation ou d'autres décisions à fort impact. Consultez [PRIVACY.md](../../PRIVACY.md).

Sous licence MIT. Les bibliothèques tierces et les éventuels futurs jeux de données ou modèles conservent leurs propres licences.

<a id="help-improve-the-experiment"></a>
## Aidez à améliorer l'expérience

Les contributions sont les bienvenues dans les domaines où le résultat peut être vérifié :

- Cas limites de qualité des images et d'étalonnage.
- Libellés accessibles, explications plus claires de l'incertitude et améliorations des traductions.
- Tests de régression pour la géométrie des AU et le comportement temporel.
- Outils d'évaluation reproductibles utilisant des données assorties des licences et consentements appropriés.

| Domaine de contribution | Fichiers par lesquels commencer | Éléments utiles |
| --- | --- | --- |
| Cas limites de qualité des images | `face-quality.js`, `face-policies.js` | Un cas de régression ciblé et le comportement attendu d'acceptation, de réduction de poids ou de suspension. |
| Étalonnage ou géométrie des AU | `face-au-detector.js`, `face-temporal.js` | Une séquence d'entrée déterministe et des limites explicites pour la sortie attendue. |
| Langue et clarté de l'interface | `face-i18n.js`, `index.html` | Les deux états linguistiques et une explication qui préserve l'incertitude. |
| Outils d'évaluation | `scripts/evaluate-au.mjs`, `evaluation/README.md` | Contrôles du manifeste et du schéma ; distinguer les éléments synthétiques de ceux issus de vidéos réelles. |

Commencez par le module concerné et `npm run check`. Dans une [demande d'intégration](https://github.com/son-gladyso/FaceExpressionVFX/pulls), expliquez le problème, les éléments disponibles, les tests réellement exécutés et ce qui reste non validé. Discutez des changements plus importants dans un [ticket](https://github.com/son-gladyso/FaceExpressionVFX/issues) avant de les mettre en œuvre.

Ne contribuez pas d'enregistrements privés de visages, de représentations vectorielles biométriques, de poids de modèles ou de jeux de données sans disposer des droits et autorisations nécessaires pour les partager. Préservez la distinction entre les mouvements observables et les affirmations concernant l'identité, les émotions, l'intention ou la santé.
