# LaPeace

LaPeace is a Sheridan Datathon project about English speech recognition and Mississauga language communities. This website introduces the study, lets visitors inspect its shared reference passage, and explains the sources and limits.

Audience: datathon judges, residents and civic-service teams. Primary action: explore the project on the homepage. The Open dashboard action opens the LAPEACE research workspace as a full page, with a return link to the homepage.

Keep the supplied LaPeace logo and navy, blue and teal palette. Use Apple Design from the connected UI Skills MCP for clear hierarchy, immediate feedback, readable typography and accessible settings. Use Cursor's Unslop skill for concrete, plain copy. Preserve the reference passage verbatim.

The Speech Accent Archive contains English recordings from speakers with different first languages. Census home-language counts describe the community, not transcription accuracy. Call Check is a separate browser-sample demo. Fixed transcript keyword rules determine its request verdict; an optional voice prototype supplies a separate score. Neither verifies caller identity. The homepage explains each dashboard tab and links the Call Check method to its source files. Do not invent results, testimonials, audio or live interactions.

The React/TypeScript website is in `web/`. All 468 recordings have bundled compressed audio previews. The Node backend supplies live Call Check; the census tab has a static snapshot. Homepage load starts no API request, microphone, paid provider call or live session. Preserve Hisham's source branches and unrelated files. The user revoked the old AGENTS.md instructions.
