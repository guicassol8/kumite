# Planejar o link de home no header não tocou em nenhuma superfície do kata

**Found while**: planejamento do #154 (tornar o wordmark "kumite" do header um
atalho para `/`).

**Where in kata**: nenhum ponto de contato — nem `kata-docs` MCP, nem
`kata verify`, nem hurl, nem DI/JWT/erros.

## What

Observação simples, sem bug — segunda entrada seguida do tipo "kata fora de
quadro" (a primeira foi a do #155). O plano saiu inteiro de leitura local:
`front/src/components/header.tsx` e seu teste, `__root.tsx`, os três catálogos
`src/i18n/{pt,es,en}.json` mais o `catalogs.test.ts` que guarda a paridade, e
`e2e/footer.spec.ts` como molde de spec com walkthrough de evidência. Zero
consultas ao `kata-docs`, nenhuma rota, schema, migration ou `.hurl` no
caminho — logo, nada de `pnpm verify` no plano além do `pnpm check` final.

O único achado do planejamento também é kumite, não kata: o Acceptance do
issue localiza o editor de blocos em `/rounds/$id`, mas ele está em
`/problem/$id`; e `front/src/` não tem nenhum bloqueio de navegação
(`useBlocker`/`beforeunload`: zero ocorrências), então o critério "navega sem
pedir confirmação" já valia por construção. Um grep de 1 turno desfez as duas
suposições antes de virarem passo de plano.

## Why it matters

Reforça o mesmo sinal da entrada do #155: o gatilho "attempt a report" produz
informação útil mesmo quando a resposta é "o kata não estava em quadro", e o
custo de registrar isso é baixo. Acumuladas, essas entradas dão a proporção
real de quanto do trabalho nesta base cruza com o framework — aqui, um issue
`stack:front` puro, sem contrato com o back, não cruzou em ponto nenhum.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Documentos lidos: **0**. Custo de
  round-trip ao MCP: **0 tokens**.
- Custo total do planejamento: ~8 chamadas de ferramenta, todas locais
  (`gh issue view`, leituras de arquivo, greps) e uma rodada de
  `AskUserQuestion` com 3 perguntas — todas de UX/cópia, nenhuma de framework.
- O `kata-docs` teria ajudado aqui? Não. Consultá-lo teria sido puro overhead.
- Atrito que valeu registrar (harness, não kata): `gh issue view 154
  --comments` devolveu saída vazia com `exit 0` três vezes seguidas, inclusive
  redirecionando para arquivo; `gh issue list` e `gh issue view --json` no
  mesmo shell funcionaram normalmente. Custou 3 turnos até trocar para
  `--json`. Vale como sinal se outros agentes baterem no mesmo silêncio.
