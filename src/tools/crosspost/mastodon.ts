import {
  accounts,
  mastodonSignIn,
  type MastodonAccount,
  type SentPost,
} from "./stores";

// Exactly what the tool uses: the account and its statuses (connection check,
// people search, finding an earlier attempt), posting, and uploading images.
const SCOPES = "read:accounts read:statuses write:statuses write:media";

export function normalizeInstance(input: string) {
  const trimmed = input.trim().replace(/^@?[^@\s/]+@/, "");
  return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    .origin;
}

async function api<T>(
  instance: string,
  token: string,
  path: string,
  init: { method?: string; body?: BodyInit; headers?: HeadersInit } = {},
): Promise<{ status: number; data: T }> {
  const response = await fetch(new URL(path, instance), {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error ?? `Mastodon answered ${response.status}`);
  return { status: response.status, data };
}

type InstanceV2 = {
  configuration?: {
    statuses?: {
      max_characters?: number;
      characters_reserved_per_url?: number;
    };
    media_attachments?: { description_limit?: number };
  };
};

async function connect(
  instance: string,
  token: string,
  app: { clientId: string; clientSecret: string },
): Promise<MastodonAccount> {
  const { data: me } = await api<{ id: string; acct: string }>(
    instance,
    token,
    "/api/v1/accounts/verify_credentials",
  );
  const { data } = await api<InstanceV2>(
    instance,
    token,
    "/api/v2/instance",
  ).catch(() => ({ data: {} as InstanceV2 }));
  const config = data.configuration;
  return {
    instance,
    clientId: app.clientId,
    clientSecret: app.clientSecret,
    token,
    id: me.id,
    acct: `${me.acct}@${new URL(instance).host}`,
    maxChars: config?.statuses?.max_characters ?? 500,
    urlLength: config?.statuses?.characters_reserved_per_url ?? 23,
    // Mastodon's default; older instances don't report it.
    altLimit: config?.media_attachments?.description_limit ?? 1500,
  };
}

const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function form<T>(url: string, fields: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error_description ??
        data.error ??
        `Mastodon answered ${response.status}`,
    );
  return data as T;
}

/**
 * Registers Ding as an app on the instance and sends the browser to its
 * sign-in page, which comes back to /crosspost.
 */
export async function signIn(instanceInput: string) {
  const instance = normalizeInstance(instanceInput);
  const redirectUri = `${location.origin}/crosspost`;
  const app = await form<{ client_id: string; client_secret: string }>(
    `${instance}/api/v1/apps`,
    {
      client_name: "Ding",
      redirect_uris: redirectUri,
      scopes: SCOPES,
      website: location.origin,
    },
  );
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const state = crypto.randomUUID();
  mastodonSignIn.set({
    instance,
    clientId: app.client_id,
    clientSecret: app.client_secret,
    redirectUri,
    state,
    verifier,
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: app.client_id,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  location.assign(`${instance}/oauth/authorize?${params}`);
}

/**
 * Finishes a sign-in when the instance redirected back with these URL
 * parameters. Returns null when they belong to no Mastodon sign-in.
 */
export async function finishSignIn(params: URLSearchParams) {
  const pending = mastodonSignIn.get();
  if (!pending || params.get("state") !== pending.state) return null;
  mastodonSignIn.reset();
  const code = params.get("code");
  if (!code)
    throw new Error(
      params.get("error_description") ?? "Mastodon sign-in was cancelled",
    );
  const { access_token } = await form<{ access_token: string }>(
    `${pending.instance}/oauth/token`,
    {
      grant_type: "authorization_code",
      code,
      client_id: pending.clientId,
      client_secret: pending.clientSecret,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
      scope: SCOPES,
    },
  );
  return connect(pending.instance, access_token, pending);
}

/** Revokes the token on the instance, which also removes Ding from its authorized apps. */
export const signOut = ({
  instance,
  clientId,
  clientSecret,
  token,
}: MastodonAccount) =>
  form(`${instance}/oauth/revoke`, {
    client_id: clientId,
    client_secret: clientSecret,
    token,
  });

const current = () => {
  const account = accounts.get().mastodon;
  if (!account) throw new Error("Mastodon isn't connected");
  return account;
};

/** Checks the token works and refreshes the instance's limits. */
export async function check() {
  const account = current();
  const fresh = await connect(account.instance, account.token, account);
  accounts.set((prev) => ({ ...prev, mastodon: fresh }));
  return fresh.acct;
}

export async function searchPeople(q: string) {
  const { instance, token } = current();
  const params = new URLSearchParams({
    q,
    limit: "8",
    // Looking up a full user@instance asks the instance to fetch it if unknown.
    resolve: String(q.includes("@")),
  });
  const { data } = await api<
    { acct: string; username: string; display_name: string; avatar: string }[]
  >(instance, token, `/api/v1/accounts/search?${params}`);
  const host = new URL(instance).host;
  return data.map((a) => ({
    ...a,
    acct: a.acct.includes("@") ? a.acct : `${a.acct}@${host}`,
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function uploadMedia(file: Blob, alt: string) {
  const { instance, token } = current();
  const form = new FormData();
  form.append("file", file);
  form.append("description", alt);
  const { status, data } = await api<{ id: string; url: string | null }>(
    instance,
    token,
    "/api/v2/media",
    { method: "POST", body: form },
  );
  // 202: still processing. Statuses can't attach it until it has a URL.
  let media = data;
  for (let i = 0; status === 202 && !media.url && i < 30; i++) {
    await sleep(1000);
    media = (
      await api<{ id: string; url: string | null }>(
        instance,
        token,
        `/api/v1/media/${data.id}`,
      )
    ).data;
  }
  return media.id;
}

type Status = {
  id: string;
  uri: string;
  url: string;
  in_reply_to_id: string | null;
};

const toSent = (status: Status): SentPost => ({
  uri: status.id,
  cid: status.uri,
  url: status.url,
});

/**
 * The post an earlier attempt may have created: one of the latest statuses,
 * created since that attempt, replying to the same parent, with the same text
 * and number of images. Mastodon's idempotency key only covers an hour, so
 * retries check for themselves.
 */
export async function findPost(
  since: number,
  parent: SentPost | undefined,
  post: { text: string; images: number },
) {
  const { instance, token, id } = current();
  const { data } = await api<
    (Status & { created_at: string; media_attachments: unknown[] })[]
  >(
    instance,
    token,
    `/api/v1/accounts/${id}/statuses?limit=10&exclude_reblogs=true`,
  );
  const candidates = data.filter(
    (status) =>
      Date.parse(status.created_at) >= since - 60_000 &&
      status.in_reply_to_id === (parent?.uri ?? null) &&
      status.media_attachments.length === post.images,
  );
  for (const status of candidates) {
    // The rendered HTML shortens links and mentions; the source is the text as sent.
    const { data: source } = await api<{ text: string }>(
      instance,
      token,
      `/api/v1/statuses/${status.id}/source`,
    );
    if (source.text.trim() === post.text.trim()) return toSent(status);
  }
  return null;
}

export async function createPost({
  text,
  images,
  parent,
  key,
}: {
  text: string;
  images: { file: Blob; alt: string }[];
  parent?: SentPost;
  key: string;
}): Promise<SentPost> {
  const mediaIds = [];
  for (const image of images)
    mediaIds.push(await uploadMedia(image.file, image.alt));
  const { instance, token } = current();
  const { data } = await api<Status>(instance, token, "/api/v1/statuses", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({
      status: text,
      media_ids: mediaIds,
      ...(parent && { in_reply_to_id: parent.uri }),
    }),
  });
  return toSent(data);
}
