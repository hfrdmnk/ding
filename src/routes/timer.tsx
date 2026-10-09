import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { play, unlockAudio, useAudioSettings } from "../lib/audio";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Dial } from "../ui/Dial";
import { Slider } from "../ui/Slider";
import { ToolShell } from "../ui/ToolShell";

export const Route = createFileRoute("/timer")({
  head: () => ({ meta: [{ title: "Interval timer · Ding" }] }),
  component: Timer,
});

const minutesSeconds = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Placeholder: shows the shared components in context until the timer is built.
function Timer() {
  const [work, setWork] = useState(45);
  const [rest, setRest] = useState(15);
  const [rounds, setRounds] = useState(8);

  return (
    <ToolShell
      title="Interval timer"
      accent="orange"
      settings={<SoundSettings />}
    >
      <p className="text-center text-secondary">Coming soon</p>
      <Dial
        fraction={2 / 3}
        color="var(--orange)"
        className="mx-auto my-10 max-w-72"
      />
      <div className="mt-auto flex flex-col gap-2">
        <Slider
          label="Work"
          value={work}
          onValueChange={setWork}
          min={5}
          max={600}
          step={5}
          format={minutesSeconds}
        />
        <Slider
          label="Rest"
          value={rest}
          onValueChange={setRest}
          min={0}
          max={300}
          step={5}
          format={minutesSeconds}
        />
        <Slider
          label="Rounds"
          value={rounds}
          onValueChange={setRounds}
          min={1}
          max={30}
        />
      </div>
    </ToolShell>
  );
}

function SoundSettings() {
  const [settings, setSettings] = useAudioSettings();

  return (
    <div className="flex flex-col gap-3">
      <Slider
        label="Volume"
        value={Math.round(settings.volume * 100)}
        onValueChange={(volume) =>
          setSettings({ ...settings, volume: volume / 100 })
        }
        min={0}
        max={100}
        format={(v) => `${v}%`}
      />
      <Checkbox
        checked={settings.muted}
        onCheckedChange={(muted) => setSettings({ ...settings, muted })}
      >
        Mute
      </Checkbox>
      <Button
        variant="ghost"
        className="-ml-4 self-start"
        onClick={async () => {
          await unlockAudio();
          play("ding");
        }}
      >
        Test sound
      </Button>
    </div>
  );
}
