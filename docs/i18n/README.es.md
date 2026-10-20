# FaceExpressionVFX v3.11

[简体中文](README.zh-CN.md) · [English](../../README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md)

**Consulta las estimaciones de movimiento facial junto con los motivos para confiar menos en ellas.**

FaceExpressionVFX es un entorno de trabajo experimental en el navegador para desarrolladores que exploran la geometría de las unidades de acción facial (AU) inspirada en FACS. El procesamiento de la cámara permanece en el dispositivo; los controles de calidad, la calibración y la incertidumbre permiten inspeccionar el proceso. La versión 3.11 informa de estimaciones de movimientos observables y de su incertidumbre; no ofrece resultados sobre identidad, intención, veracidad, sinceridad, personalidad ni diagnósticos psicológicos o médicos.

[Primer experimento](#first-experiment) · [Ejecución local](#run-and-verify) · [Proceso](#v311-algorithm-pipeline) · [Preguntas frecuentes](#common-questions) · [Contribuir](#help-improve-the-experiment)

<a id="what-you-can-explore"></a>
## Qué puedes explorar

Las demostraciones de movimiento facial suelen mostrar un número sin explicar cuándo deja de ser fiable. Este proyecto hace visibles las comprobaciones de calidad y la incertidumbre junto con las estimaciones de movimiento.

- Inspeccionar resúmenes de movimientos de cejas, ojos, mejillas, nariz, labios y boca.
- Ver cómo afectan al resultado la calibración, la postura de la cabeza y la calidad de los fotogramas.
- Explorar las reglas deterministas y las pruebas antes de añadir un modelo opcional.
- Registrar el historial solo cuando lo decidas y exportarlo después mediante una descarga local.

Está pensado para desarrolladores y personas que realizan experimentos y desean estudiar el movimiento facial observable y las limitaciones de un proceso basado en geometría. No infiere lo que siente o pretende una persona.

<a id="first-experiment"></a>
## Primer experimento

Sigue [Ejecución y verificación](#run-and-verify) para iniciar la aplicación. Comienza con el rostro neutro y bien iluminado, sigue el proceso de calibración y después prueba un pequeño movimiento visible, como levantar las cejas o abrir la boca. Observa tanto los indicadores de calidad e incertidumbre como los valores de movimiento.

Una comparación útil es la de una vista frontal nítida frente a otra más difícil. Los fotogramas de baja calidad deben tratarse como evidencia limitada, no como conclusiones más firmes sobre un rostro. El proceso documentado puede reducir el peso de la inferencia o pausarla.

Todavía no se incluye aquí ninguna grabación de una cámara real. La evaluación sintética incluida comprueba los contratos de prueba, no la exactitud en vídeos de personas.

<a id="three-useful-things-to-compare"></a>
### Tres comparaciones útiles

| Experimento | Qué observar | Qué no concluir |
| --- | --- | --- |
| Rostro neutro, seguido de un pequeño movimiento de cejas o boca | Estimaciones de movimiento y sus intervalos | Que un valor mide emociones, sinceridad o intención. |
| Vista frontal, seguida de una postura o iluminación más difícil | Puntuación de calidad, confianza y comportamiento de pausa o reducción de peso | Que una imagen deficiente aporta evidencia más sólida sobre la persona. |
| Iniciar explícitamente una grabación breve y después exportarla | Historial local y salida JSON/CSV | Que la exportación es un diagnóstico validado o un informe de exactitud en condiciones reales. |

La interfaz incluye un selector de chino/inglés, historial y controles de exportación JSON/CSV. Grabar es una acción deliberada, no un requisito para inspeccionar el proceso en directo.

<a id="v311-algorithm-pipeline"></a>
## Proceso algorítmico de v3.11

1. MediaPipe proporciona 468 puntos de referencia faciales normalizados o más.
2. Un control de calidad de fotogramas puntúa la integridad de los puntos de referencia, los límites y la escala del rostro, la postura de la cabeza, la iluminación, el contraste, la saturación de niveles de imagen, la nitidez y un indicador indirecto de visibilidad o reflejos en la región de los ojos.
3. Los fotogramas se aceptan, reciben un menor peso de confianza o se pausan. Los fotogramas pausados no pueden actualizar la inferencia de AU ni la calibración personal.
4. Una referencia personal robusta utiliza medianas y la desviación absoluta mediana (MAD), rechaza fotogramas de baja calidad o atípicos y solo aplica una deriva lenta y acotada en fotogramas de alta calidad y con poco movimiento.
5. La compensación de la postura de la cabeza y las distancias normalizadas respecto al rostro reducen los efectos de la postura y de la geometría estable propia de cada persona antes de calcular las AU.
6. Cada AU devuelve `value`, `lower`, `upper`, `confidence` y una `region` anatómica.
7. Un filtro temporal bayesiano de duración explícita sustituye a la histéresis basada en el número de fotogramas e informa de la confianza posterior y de la incertidumbre normalizada.
8. A partir de las estimaciones de AU se obtienen doce resúmenes de movimientos observables, propagando sus intervalos.

No se incluye ningún modelo entrenado. Un proveedor de AU opcional solo se habilita si sus metadatos contienen nombre, versión, licencia, procedencia de los datos de entrenamiento, correspondencia de etiquetas de AU y métricas de evaluación. Su contribución se pondera por calidad y tiene un límite; las reglas geométricas deterministas se mantienen como alternativa de respaldo.

<a id="run-and-verify"></a>
## Ejecución y verificación

Prepara Node.js/npm, un navegador moderno compatible con cámaras y una cámara que funcione. Ejecuta los comandos desde la raíz del repositorio. Utiliza `localhost` o HTTPS para acceder a la cámara y permite el acceso a la red para los scripts de la CDN de MediaPipe y las fuentes web. Que los fotogramas se procesen localmente no significa que el primer inicio sea totalmente sin conexión.

```powershell
npm install
npm run check
npm start
```

`npm start` inicia un servidor estático en el puerto 8080 y solicita que el navegador lo abra. Si es necesario, abre `http://localhost:8080` manualmente. El comando utiliza `npx http-server`, que puede descargar el servidor la primera vez que se use.

**Primera acción satisfactoria:** inspecciona el panel de calibración/calidad en directo, realiza un movimiento visible y compara su estimación con la visualización de incertidumbre. Superar las comprobaciones de la línea de comandos no sustituye esta comprobación con la cámara.

`npm run check` ejecuta pruebas unitarias y de contrato, un conjunto determinista de prueba para métricas de AU, ESLint y comprobaciones estáticas de la versión. La CLI de evaluación informa de la precisión, la exhaustividad, F1 y la tasa de falsos positivos por AU, además de resúmenes de sujetos reservados para evaluación:

```powershell
node scripts/evaluate-au.mjs evaluation/fixtures/synthetic-au-eval.json
```

Los vectores incluidos son pruebas sintéticas de contrato, no evidencia de exactitud en condiciones reales. Consulta los requisitos del manifiesto fijo de vídeos en [evaluation/README.md](../../evaluation/README.md). Para v3.11 no se disponía de ningún conjunto de vídeos de personas redistribuible y etiquetado legalmente, por lo que esta versión no afirma tener una determinada exactitud en vídeos reales ni capacidad de generalización entre personas.

<a id="main-modules"></a>
## Módulos principales

- `face-quality.js` — controles de fotogramas e intervalos de confianza de AU
- `face-au-detector.js` — calibración robusta, compensación de postura y geometría determinista de AU
- `face-temporal.js` — filtro bayesiano de estados de duración explícita
- `face-observables.js` — resúmenes de movimientos directamente observables
- `face-model-adapter.js` — clasificador opcional condicionado a su procedencia y respaldo mediante reglas
- `scripts/evaluate-au.mjs` — métricas de AU con manifiesto fijo e informes con sujetos reservados para evaluación

<a id="common-questions"></a>
## Preguntas frecuentes

**¿Es un detector de emociones?** No. Las salidas son indicadores indirectos de geometría y movimiento, no etiquetas de estados mentales.

**¿Por qué se pausa la inferencia o disminuye la confianza?** El control de calidad tiene en cuenta la postura, la visibilidad, la iluminación y otras condiciones del fotograma. Revisa los indicadores de calidad y mejora la vista, en lugar de interpretar un resultado pausado como un hallazgo negativo sobre la persona.

**¿Se incluye un modelo de AU entrenado?** No. El proceso incluido utiliza geometría determinista. Los proveedores opcionales necesitan metadatos e información de procedencia, licencia y evaluación antes de poder contribuir.

**¿La evaluación sintética demuestra la exactitud con mi cámara?** No. Verifica contratos de métricas y pruebas. La validación con vídeos reales requiere un conjunto de evaluación adecuado, etiquetado legalmente, y el proceso de manifiesto fijo de [evaluation/README.md](../../evaluation/README.md).

**¿Dónde está el historial grabado?** En el IndexedDB local del navegador, después de iniciar la grabación. Las exportaciones son descargas locales; trata las grabaciones y las exportaciones como datos personales, aunque no se suban automáticamente.

<a id="privacy-and-limits"></a>
## Privacidad y límites

Los fotogramas de la cámara se procesan en el navegador. Este proyecto no sube nada. El historial solo se registra después de que el usuario inicia la grabación y permanece en el IndexedDB local; las exportaciones son descargas locales explícitas. No utilices FaceExpressionVFX para identificación, vigilancia, atención sanitaria, empleo, seguros, actuaciones policiales, disciplina educativa ni otras decisiones de gran impacto. Consulta [PRIVACY.md](../../PRIVACY.md).

Distribuido bajo licencia MIT. Las bibliotecas de terceros y cualquier futuro conjunto de datos o modelo conservan sus propias licencias.

<a id="help-improve-the-experiment"></a>
## Ayuda a mejorar el experimento

Las contribuciones son bienvenidas en áreas cuyos resultados puedan comprobarse:

- Casos límite de calidad de fotogramas y calibración.
- Etiquetas accesibles, explicaciones más claras de la incertidumbre y mejoras de traducción.
- Pruebas de regresión de la geometría de AU y del comportamiento temporal.
- Herramientas de evaluación reproducibles con datos debidamente autorizados mediante licencia y consentimiento.

| Área de contribución | Archivos por los que empezar | Evidencia útil |
| --- | --- | --- |
| Casos límite de calidad de fotogramas | `face-quality.js`, `face-policies.js` | Un caso de regresión acotado y el comportamiento esperado de aceptación, reducción de peso o pausa. |
| Calibración o geometría de AU | `face-au-detector.js`, `face-temporal.js` | Una secuencia de entrada determinista y límites explícitos de la salida esperada. |
| Claridad del idioma y de la interfaz | `face-i18n.js`, `index.html` | Ambos estados de idioma y una explicación que preserve la incertidumbre. |
| Herramientas de evaluación | `scripts/evaluate-au.mjs`, `evaluation/README.md` | Comprobaciones de manifiesto y esquema; etiquetar por separado la evidencia sintética y la de vídeos reales. |

Empieza por el módulo correspondiente y `npm run check`. En una [solicitud de incorporación de cambios](https://github.com/son-gladyso/FaceExpressionVFX/pulls), explica el problema, la evidencia, las pruebas que realmente ejecutaste y lo que queda sin validar. Comenta los cambios de mayor alcance en una [incidencia](https://github.com/son-gladyso/FaceExpressionVFX/issues) antes de implementarlos.

No aportes grabaciones privadas de rostros, representaciones vectoriales biométricas, pesos de modelos ni conjuntos de datos sin los derechos y permisos necesarios para compartirlos. Mantén la distinción entre el movimiento observable y las afirmaciones sobre identidad, emociones, intención o salud.
