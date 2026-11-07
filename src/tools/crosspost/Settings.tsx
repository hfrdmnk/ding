import {
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { useStore } from "../../lib/store";
import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { TextField } from "../../ui/TextField";
import * as bluesky from "./bluesky";
import * as mastodon from "./mastodon";
import { checkLabel, type Check } from "./connection";
import { accounts, preferences } from "./stores";
import type { Platform } from "./text";

const linkClass =
  "underline decoration-[color-mix(in_oklab,var(--secondary)_45%,var(--bg))] underline-offset-2 hover:text-primary";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Connected({
  name,
  check,
  onDisconnect,
}: {
  name: string;
  check: Check | undefined;
  onDisconnect: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate">{name}</p>
        <p aria-live="polite" className="text-sm text-secondary">
          {checkLabel(check)}
        </p>
      </div>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onDisconnect();
          setBusy(false);
        }}
      >
        {busy ? "Disconnecting…" : "Disconnect"}
      </Button>
    </div>
  );
}

function useConnect(connect: (form: FormData) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // On success the browser leaves for the sign-in page.
      await connect(new FormData(event.currentTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return { busy, error, onSubmit };
}

const noSubscribe = () => () => {};

const REVOKE_HINT: Record<Platform, string> = {
  bluesky: "Remove Ding from your account’s connected apps.",
  mastodon: "Remove Ding under Preferences › Account › Authorized apps.",
};

export function Settings({
  checks,
}: {
  checks: Partial<Record<Platform, Check>>;
}) {
  const [{ bluesky: sky, mastodon: masto, claudeKey }, setAccounts] =
    useStore(accounts);
  const [{ numbering }, setPreferences] = useStore(preferences);
  const [signOutError, setSignOutError] = useState<
    Partial<Record<Platform, string>>
  >({});
  const blueskySignIn = useSyncExternalStore(
    noSubscribe,
    bluesky.canSignIn,
    () => true,
  );

  const skyForm = useConnect((form) =>
    bluesky.signIn(String(form.get("handle"))),
  );
  const mastoForm = useConnect((form) =>
    mastodon.signIn(String(form.get("instance"))),
  );

  // Forgets the account here even when the server can't be reached, and says
  // so, because a token that may still work should be removed by hand.
  const disconnect = async (platform: Platform) => {
    try {
      if (platform === "bluesky" && sky) await bluesky.signOut(sky.did);
      if (platform === "mastodon" && masto) await mastodon.signOut(masto);
      setSignOutError((prev) => ({ ...prev, [platform]: undefined }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSignOutError((prev) => ({
        ...prev,
        [platform]: `Disconnected here, but the sign-out didn’t go through (${message}). ${REVOKE_HINT[platform]}`,
      }));
    }
    setAccounts((prev) => ({ ...prev, [platform]: null }));
  };

  return (
    <div className="flex flex-col gap-8">
      <Section title="Bluesky">
        {signOutError.bluesky && (
          <p role="alert" className="text-sm">
            {signOutError.bluesky}
          </p>
        )}
        {sky ? (
          <Connected
            name={`@${sky.handle}`}
            check={checks.bluesky}
            onDisconnect={() => disconnect("bluesky")}
          />
        ) : !blueskySignIn ? (
          <p className="text-sm text-secondary">
            Bluesky sign-in works on{" "}
            <a
              className={linkClass}
              href="https://ding.dominikhofer.me/crosspost"
            >
              ding.dominikhofer.me
            </a>
            , and on 127.0.0.1 while developing.
          </p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={skyForm.onSubmit}>
            <TextField
              label="Handle"
              name="handle"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you.bsky.social"
            />
            <p className="text-sm text-secondary">
              You sign in on your own Bluesky server, so Ding never sees your
              password. It can only create posts and upload images.
            </p>
            {skyForm.error && (
              <p role="alert" className="text-sm">
                {skyForm.error}
              </p>
            )}
            <Button type="submit" variant="ghost" disabled={skyForm.busy}>
              {skyForm.busy ? "Opening Bluesky…" : "Connect Bluesky"}
            </Button>
          </form>
        )}
      </Section>

      <Section title="Mastodon">
        {signOutError.mastodon && (
          <p role="alert" className="text-sm">
            {signOutError.mastodon}
          </p>
        )}
        {masto ? (
          <Connected
            name={`@${masto.acct}`}
            check={checks.mastodon}
            onDisconnect={() => disconnect("mastodon")}
          />
        ) : (
          <form className="flex flex-col gap-3" onSubmit={mastoForm.onSubmit}>
            <TextField
              label="Instance"
              name="instance"
              required
              autoCapitalize="none"
              spellCheck={false}
              placeholder="mastodon.social"
            />
            <p className="text-sm text-secondary">
              You sign in on your instance. Ding asks only to read your account
              and posts, to post, and to upload images.
            </p>
            {mastoForm.error && (
              <p role="alert" className="text-sm">
                {mastoForm.error}
              </p>
            )}
            <Button type="submit" variant="ghost" disabled={mastoForm.busy}>
              {mastoForm.busy ? "Opening Mastodon…" : "Connect Mastodon"}
            </Button>
          </form>
        )}
      </Section>

      <Section title="Thread">
        <Checkbox
          checked={numbering}
          onCheckedChange={(numbering) =>
            setPreferences((prev) => ({ ...prev, numbering }))
          }
        >
          <span className="text-sm font-medium text-secondary">
            Number posts (1/3, 2/3…)
          </span>
        </Checkbox>
      </Section>

      <Section title="Alt text">
        <TextField
          label="Claude API key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={claudeKey}
          onChange={(e) =>
            setAccounts((p) => ({ ...p, claudeKey: e.target.value.trim() }))
          }
        />
        <p className="text-sm text-secondary">
          With a key, Claude writes alt text for each image you add. The key
          stays on this device.{" "}
          <a
            className={linkClass}
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
          >
            Get a key
          </a>
        </p>
      </Section>
    </div>
  );
}
