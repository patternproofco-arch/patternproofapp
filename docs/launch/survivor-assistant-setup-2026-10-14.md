# Survivor assistant setup — October 14, 2026

The survivor home page now links to **AI assistance & connected apps** in account settings. The panel explains how to connect Claude, ChatGPT or another remote MCP/OAuth assistant to this deployment's `/mcp` address. It includes a copyable server address, current official provider setup guides, a documentation starter prompt and a link to review drafts in the journal. Copying the address or choosing a provider grants no access.

The existing server-owned opt-in remains off by default. Enabling it requires password verification or a recent passwordless sign-in; each assistant still needs its own OAuth consent. Disabling access blocks future tool calls and revokes connections. The connector continues to exclude incidents and evidence marked no-AI and saves assistant-written incidents as AI-extracted, unconfirmed drafts. Its four tools cannot confirm, edit or delete records. Search exposes voice-note titles, not recordings or transcripts. The consent screen describes these actual capabilities and explains that revocation does not erase previously shared provider-chat information.

Failed account reads now show a retryable error rather than claiming access is off or no apps are connected. Connection notices are acknowledged only after the list loads successfully. The browser fixture can serialize server-function failures, enabling a real error-recovery UI regression.

Before this feature, production `/version.json` reported commit `c259a33352b954cf4d2a66eb89675351656e9afc`, build `8122b774c339`, built October 14 at 15:05 UTC, with a source digest. Public MCP discovery and the attached Supabase OAuth discovery responded successfully; an unauthenticated MCP initialize request was denied. These observations supersede the older publication observations in the launch readiness report. They do not establish that a real provider account has completed consent.

Validation: TypeScript, the production Worker build, focused assistant/no-AI tests, all 130 unit files / 1,299 tests, and nine new browser cases across Chromium, Android emulation and iOS WebKit pass. These use fictional sessions and mock clipboard access; no survivor records are sent to providers. No database migration or new provider secret is needed. Real Claude/ChatGPT sign-in and draft creation require a survivor-controlled provider account; availability and write permissions depend on provider plan and workspace settings.

Provider references checked October 14:

- [Claude remote MCP setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [ChatGPT developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)

After publishing, run the source verification script from the exact released checkout. Then, with a fictional survivor and an account you control, enable access, connect an assistant, describe a fictional dated incident, approve saving a draft, review it in the journal, and revoke the connection. Verify the assistant cannot access records after revocation and cannot read an incident or evidence description marked no-AI.
