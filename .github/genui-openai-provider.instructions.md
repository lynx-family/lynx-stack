---
applyTo: "packages/genui/server/{agent,app,service}/**"
---

Treat `https://aidp.bytedance.net/api/modelhub/online/v2/crawl` as a complete OpenAI Chat Completions-compatible endpoint. Unless `api` or `OPENAI_API_STYLE` explicitly overrides the selection, use the Chat Completions `messages` request format, but send the HTTP request to the exact `/crawl` URL with the API key in the `ak` query parameter and an `X-TT-LOGID` request header. Read an explicit log ID from `AIDP_LOG_ID` or `OPENAI_LOG_ID`, otherwise generate one per upstream request. Remove the ordinary OpenAI Bearer authorization header for AIDP. Never log or return the rewritten URL because its query string contains the credential. Do not append `/chat/completions`, because that path does not exist, and do not use the Responses `input` request format because AIDP requires `Messages`.

AIDP non-streaming Chat responses may omit `choices[].index`, although the OpenAI provider schema requires it. Normalize successful AIDP JSON responses before AI SDK validation by assigning each missing choice index from its array position. Preserve existing numeric indexes, leave malformed or error responses unchanged, and remove stale payload encoding and length headers when rebuilding a decoded response body.

OpenAI-compatible non-streaming generation can legitimately take longer than Undici's 300-second default headers timeout because the provider may not send headers until generation completes. Use the shared Undici transport with both `headersTimeout` and `bodyTimeout` set from `OPENAI_FETCH_TIMEOUT_MS`; default to 10 minutes and clamp configured values to 1 second through 30 minutes. Preserve caller abort signals and keep the timeout scoped to this provider transport rather than changing Undici's global dispatcher.
