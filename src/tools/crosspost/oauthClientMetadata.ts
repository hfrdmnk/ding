import type { OAuthClientMetadataInput } from "@atproto/oauth-client-browser";

/**
 * Bluesky's OAuth servers fetch this from its own `client_id` URL; the build
 * writes it to dist/client/oauth-client-metadata.json (see vite.config.ts).
 */
export const clientMetadata = {
  client_id: "https://ding.dominikhofer.me/oauth-client-metadata.json",
  client_name: "Ding",
  client_uri: "https://ding.dominikhofer.me",
  logo_uri: "https://ding.dominikhofer.me/pwa-192x192.png",
  redirect_uris: ["https://ding.dominikhofer.me/crosspost"],
  // Only what posting needs: create post records and upload images.
  scope: "atproto repo:app.bsky.feed.post?action=create blob:image/*",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  application_type: "web",
  dpop_bound_access_tokens: true,
} satisfies OAuthClientMetadataInput;
