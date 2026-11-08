# LAPEACE Agent Entry Point

Read [.agent.md](.agent.md), [PRD.md](PRD.md), and [.spec.md](.spec.md) before implementation. These files define the task protocol, product acceptance criteria, and technical contracts.

- The active user request and higher-priority environment instructions take precedence.
- Work only on your assigned task and write paths from [coordination/tasks.json](coordination/tasks.json). One coordinator assigns work and owns shared files. Agents do not launch more agents unless their task explicitly permits it.
- Preserve other contributors' edits. Never reset, clean, or replace the worktree to simplify integration.
- Keep the source dataset read-only and bulk audio, caches, credentials, and personal recordings out of Git.
- The foundation release is voice access evidence, ward context, and one simulated service interaction. Phishing detection is deferred.
- Do not invent transcripts, scores, tests, provider availability, or completed work. Label development fixtures and cached replay.
- Report changes and checks in the assigned task handoff. Only the coordinator marks a task done after review and integration.

If the current task is documentation or review only, do not begin implementation or claim an implementation task without that scope being assigned. A tool that does not automatically read this file must receive it and the playbook explicitly in its startup brief.
