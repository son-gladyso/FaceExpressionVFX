# FaceExpressionVFX v3.11

[简体中文](README.zh-CN.md) · [English](../../README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru.md) · [繁體中文](README.zh-TW.md)

**Veja as estimativas de movimento facial junto com os motivos para confiar menos nelas.**

FaceExpressionVFX é um ambiente experimental no navegador para desenvolvedores que exploram a geometria de unidades de ação facial (AU) inspirada no FACS. O processamento da câmera permanece local; os controles de qualidade, a calibração e a incerteza tornam o fluxo de processamento inspecionável. A versão 3.11 apresenta estimativas de movimentos observáveis e sua incerteza; não fornece resultados sobre identidade, intenção, veracidade, sinceridade, personalidade ou diagnósticos psicológicos e médicos.

[Primeiro experimento](#first-experiment) · [Executar localmente](#run-and-verify) · [Fluxo de processamento](#v311-algorithm-pipeline) · [Perguntas frequentes](#common-questions) · [Contribuir](#help-improve-the-experiment)

<a id="what-you-can-explore"></a>
## O que você pode explorar

Demonstrações de movimento facial costumam mostrar um número sem explicar quando ele deixa de ser confiável. Este projeto torna as verificações de qualidade e a incerteza visíveis ao lado das estimativas de movimento.

- Inspecionar resumos dos movimentos das sobrancelhas, olhos, bochechas, nariz, lábios e boca.
- Ver como a calibração, a postura da cabeça e a qualidade dos quadros afetam a saída.
- Explorar as regras determinísticas e os testes antes de adicionar um modelo opcional.
- Registrar o histórico somente quando você decidir e depois exportá-lo como um download local.

O projeto é destinado a desenvolvedores e pessoas que realizam experimentos e desejam estudar os movimentos faciais observáveis e os limites de um fluxo de processamento baseado em geometria. Ele não infere o que uma pessoa sente ou pretende.

<a id="first-experiment"></a>
## Primeiro experimento

Siga [Executar e verificar](#run-and-verify) para iniciar o aplicativo. Comece com o rosto neutro e bem iluminado, siga o fluxo de calibração e depois tente um pequeno movimento visível, como levantar as sobrancelhas ou abrir a boca. Observe os indicadores de qualidade e incerteza, além dos valores de movimento.

Uma comparação útil é uma visão frontal nítida em relação a uma visão mais difícil. Quadros de baixa qualidade devem ser tratados como evidência limitada, não como fundamento para conclusões mais fortes sobre um rosto. O fluxo documentado pode reduzir o peso da inferência ou pausá-la.

Ainda não há nenhuma gravação de câmera real incorporada aqui. A avaliação sintética incluída verifica contratos de teste, não a acurácia em vídeos de pessoas.

<a id="three-useful-things-to-compare"></a>
### Três comparações úteis

| Experimento | O que observar | O que não concluir |
| --- | --- | --- |
| Rosto neutro, seguido de um pequeno movimento de sobrancelhas ou boca | Estimativas de movimento e seus intervalos | Que um valor mede emoção, sinceridade ou intenção. |
| Visão frontal, seguida de uma postura ou iluminação mais difícil | Pontuação de qualidade, confiança e comportamento de pausa ou redução de peso | Que uma imagem ruim fornece evidências mais fortes sobre a pessoa. |
| Iniciar explicitamente uma gravação curta e depois exportar | Histórico local e saída JSON/CSV | Que a exportação é um diagnóstico validado ou um relatório de acurácia em condições reais. |

A interface inclui um seletor de chinês/inglês, histórico e controles de exportação JSON/CSV. Gravar é uma ação deliberada, não um pré-requisito para inspecionar o processamento ao vivo.

<a id="v311-algorithm-pipeline"></a>
## Fluxo algorítmico da v3.11

1. O MediaPipe fornece 468 ou mais pontos de referência faciais normalizados.
2. Um controle de qualidade de quadros pontua a integridade dos pontos de referência, os limites e a escala do rosto, a postura da cabeça, a iluminação, o contraste, o recorte de níveis de imagem, a nitidez e um indicador indireto de visibilidade ou reflexos na região dos olhos.
3. Os quadros são aceitos, recebem peso de confiança reduzido ou são pausados. Quadros pausados não podem atualizar a inferência de AU nem a calibração pessoal.
4. Uma referência pessoal robusta usa medianas e o desvio absoluto mediano (MAD), rejeita quadros de baixa qualidade ou atípicos e aplica apenas uma deriva lenta e limitada em quadros de alta qualidade com pouco movimento.
5. A compensação da postura da cabeça e as distâncias normalizadas em relação ao rosto reduzem os efeitos da postura e da geometria estável própria de cada pessoa antes do cálculo de AU.
6. Cada AU retorna `value`, `lower`, `upper`, `confidence` e uma `region` anatômica.
7. Um filtro temporal bayesiano de duração explícita substitui a histerese baseada na contagem de quadros e informa a confiança posterior e a incerteza normalizada.
8. Doze resumos de movimentos observáveis são derivados das estimativas de AU, com propagação dos intervalos.

Nenhum modelo treinado está incluído. Um provedor opcional de AU só é ativado quando seus metadados incluem nome, versão, licença, procedência dos dados de treinamento, mapeamento dos rótulos de AU e métricas de avaliação. Sua contribuição é ponderada pela qualidade e limitada; as regras geométricas determinísticas permanecem como alternativa de segurança.

<a id="run-and-verify"></a>
## Executar e verificar

Prepare Node.js/npm, um navegador moderno compatível com câmeras e uma câmera funcionando. Execute a partir da raiz do repositório. Use `localhost` ou HTTPS para acessar a câmera e permita o acesso à rede para os scripts da CDN do MediaPipe e as fontes web. Processar os quadros localmente não torna a primeira inicialização totalmente offline.

```powershell
npm install
npm run check
npm start
```

`npm start` inicia um servidor estático na porta 8080 e solicita que o navegador o abra. Se necessário, abra `http://localhost:8080` manualmente. O comando usa `npx http-server`, que pode baixar o servidor no primeiro uso.

**Primeira ação bem-sucedida:** inspecione o painel de calibração/qualidade ao vivo, faça um movimento visível e compare a estimativa com a exibição de incerteza. Passar nas verificações da linha de comando não substitui essa verificação com a câmera.

`npm run check` executa testes unitários e de contrato, um conjunto determinístico de teste das métricas de AU, ESLint e verificações estáticas de lançamento. A CLI de avaliação informa precisão, revocação, F1 e taxa de falsos positivos por AU, além de resumos dos participantes reservados para avaliação:

```powershell
node scripts/evaluate-au.mjs evaluation/fixtures/synthetic-au-eval.json
```

Os vetores incluídos são testes sintéticos de contrato, não evidências de acurácia no mundo real. Consulte [evaluation/README.md](../../evaluation/README.md) para conhecer os requisitos do manifesto fixo de vídeos. Não havia um conjunto de vídeos de pessoas redistribuível e rotulado legalmente para a v3.11; portanto, esta versão não faz afirmações de acurácia em vídeos reais nem de generalização entre pessoas.

<a id="main-modules"></a>
## Módulos principais

- `face-quality.js` — controles de quadros e intervalos de confiança de AU
- `face-au-detector.js` — calibração robusta, compensação de postura e geometria determinística de AU
- `face-temporal.js` — filtro bayesiano de estados de duração explícita
- `face-observables.js` — resumos de movimentos diretamente observáveis
- `face-model-adapter.js` — classificador opcional condicionado à procedência e alternativa baseada em regras
- `scripts/evaluate-au.mjs` — métricas de AU com manifesto fixo e relatórios com participantes reservados para avaliação

<a id="common-questions"></a>
## Perguntas frequentes

**Isto é um detector de emoções?** Não. As saídas são indicadores indiretos de geometria e movimento, não rótulos de estados mentais.

**Por que a inferência pausa ou a confiança cai?** O controle de qualidade considera postura, visibilidade, iluminação e outras condições dos quadros. Confira os indicadores de qualidade e melhore a imagem, em vez de interpretar um resultado pausado como uma constatação negativa sobre a pessoa.

**Há um modelo de AU treinado incluído?** Não. O fluxo incluído usa geometria determinística. Provedores opcionais precisam de metadados e informações de procedência, licenciamento e avaliação antes de poderem contribuir.

**A avaliação sintética comprova a acurácia na minha câmera?** Não. Ela verifica contratos de métricas e testes. A validação com vídeos reais exige um conjunto de avaliação adequado, rotulado legalmente, e o processo de manifesto fixo descrito em [evaluation/README.md](../../evaluation/README.md).

**Onde fica o histórico gravado?** No IndexedDB local do navegador, depois que você inicia a gravação. As exportações são downloads locais; trate gravações e exportações como dados pessoais, mesmo que não sejam enviadas automaticamente.

<a id="privacy-and-limits"></a>
## Privacidade e limites

Os quadros da câmera são processados no navegador. Este projeto não envia nada. O histórico só é registrado depois que o usuário inicia a gravação e permanece no IndexedDB local; as exportações são downloads locais explícitos. Não use FaceExpressionVFX para identificação, vigilância, assistência à saúde, emprego, seguros, policiamento, medidas disciplinares na educação ou outras decisões de alto impacto. Consulte [PRIVACY.md](../../PRIVACY.md).

Licenciado sob a MIT. Bibliotecas de terceiros e quaisquer futuros conjuntos de dados ou modelos mantêm suas próprias licenças.

<a id="help-improve-the-experiment"></a>
## Ajude a melhorar o experimento

Contribuições são bem-vindas em áreas nas quais o resultado pode ser verificado:

- Casos extremos de qualidade de quadros e calibração.
- Rótulos acessíveis, explicações mais claras da incerteza e melhorias de tradução.
- Testes de regressão da geometria de AU e do comportamento temporal.
- Ferramentas de avaliação reproduzíveis com dados devidamente licenciados e obtidos com consentimento.

| Área de contribuição | Arquivos para começar | Evidência útil |
| --- | --- | --- |
| Casos extremos de qualidade de quadros | `face-quality.js`, `face-policies.js` | Um caso de regressão focado e o comportamento esperado de aceitação, redução de peso ou pausa. |
| Calibração ou geometria de AU | `face-au-detector.js`, `face-temporal.js` | Uma sequência de entrada determinística e limites explícitos para a saída esperada. |
| Idioma e clareza da interface | `face-i18n.js`, `index.html` | Os dois estados de idioma e uma explicação que preserve a incerteza. |
| Ferramentas de avaliação | `scripts/evaluate-au.mjs`, `evaluation/README.md` | Verificações de manifesto e esquema; identificar separadamente as evidências sintéticas e as de vídeos reais. |

Comece pelo módulo relevante e por `npm run check`. Em uma [solicitação de integração](https://github.com/son-gladyso/FaceExpressionVFX/pulls), explique o problema, as evidências, os testes realmente executados e o que continua sem validação. Discuta mudanças maiores em uma [issue](https://github.com/son-gladyso/FaceExpressionVFX/issues) antes de implementá-las.

Não contribua com gravações privadas de rostos, representações vetoriais biométricas, pesos de modelos ou conjuntos de dados sem os direitos e as permissões para compartilhá-los. Preserve a distinção entre movimentos observáveis e afirmações sobre identidade, emoções, intenção ou saúde.
