🧠 MIPT: AGENTS.md — SOTA & Context Engineering Protocol

Qualquer comando com output desconhecido ou potencialmente grande DEVE ser byte-capped.

Padrão Obrigatório:

Bash
COMMAND 2>&1 | head -c 4000
Nunca uses cat, head -n ou grep em ficheiros de dados sem o pipe para head -c 4000.

Se o ficheiro for binário ou sem newlines (como bases de dados), o byte-cap é a única proteção contra o colapso do contexto.
