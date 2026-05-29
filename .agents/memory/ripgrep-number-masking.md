---
name: Ripgrep masks numeric values in this environment
description: When auditing prices/numbers, ripgrep output appeared to redact numeric strings; verify with grep/sed/read tool.
---

During a pricing audit, `rg` (the ripgrep bash tool) returned placeholder tokens
("n", "ln") where the files actually contained numeric values like `21.99`,
`65.97`. The same files read with `grep -n`, `sed -n`, and the `read` tool showed
the real numbers (`21,99€`, `65,97€`).

**Rule:** Do not trust ripgrep (`rg`) output for the exact value of numeric
strings (prices, ids, amounts). Confirm with `grep`, `sed`, or the `read` tool
before editing based on a number you saw via `rg`.

**Why:** Editing prices/values from corrupted `rg` output would silently apply
wrong changes. This cost an investigation cycle when `rg` showed `price: "n"` but
the file actually had `price: "21.99"`.

**How to apply:** For any task where the precise digits matter (pricing, version
pins, ids), audit with `grep`/`sed` or open the file with `read`. Use `rg` only to
locate which files/lines contain the pattern, not to read the value itself.
