# kenkeep Index: app / config

↑ Parent: [app](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) to learn about: Higher-priority values override lower-priority values on a per-key shallow merge. #config #precedence
- Open [**Apply config precedence: project overrides user overrides defaults**](practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) to learn about: \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults. #config #precedence

## Components (what exists)
- Open [**.self-review.yaml project config**](map-self-review-yaml-project-config.md) to learn about: Optional per-project YAML config defining critique categories and output-file path. #self-review #config
- Open [**self-review YAML configuration options**](map-self-review-yaml-configuration-options.md) to learn about: User (\`~/.config/self-review/config.yaml\`) and project (\`.self-review.yaml\`) configs control theme, diff view, categories, payload limits, and more. #config #yaml
- Open [**User and project YAML configuration**](map-user-and-project-yaml-configuration.md) to learn about: User config at ~/.config/self-review/config.yaml; project config at .self-review.yaml in the repo root. #config #yaml #files

## By topic

### #config
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) — Higher-priority values override lower-priority values on a per-key shallow merge.
- Open [**Apply config precedence: project overrides user overrides defaults**](practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) — \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults.
- Open [**Knowledge base config locations**](../../knowledge-base/structure/map-knowledge-base-config-locations.md) — KB config is read from \`.ai/knowledge-base/config.yaml\`, with fallback to \`~/.config/ai-knowledge-base/config.yaml\`.
### #precedence
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) — Higher-priority values override lower-priority values on a per-key shallow merge.
- Open [**Apply config precedence: project overrides user overrides defaults**](practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) — \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults.
### #yaml
- Open [**self-review YAML configuration options**](map-self-review-yaml-configuration-options.md) — User (\`~/.config/self-review/config.yaml\`) and project (\`.self-review.yaml\`) configs control theme, diff view, categories, payload limits, and more.
- Open [**User and project YAML configuration**](map-user-and-project-yaml-configuration.md) — User config at ~/.config/self-review/config.yaml; project config at .self-review.yaml in the repo root.
### #files
- Open [**User and project YAML configuration**](map-user-and-project-yaml-configuration.md) — User config at ~/.config/self-review/config.yaml; project config at .self-review.yaml in the repo root.
### #self-review
- Open [**Set viewed="true" on every file in critique output**](../../skills/critique/output/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../../skills/critique/suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../../skills/critique/suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.