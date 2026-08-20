import type { ViewerProfile } from "@workspace/api-client-react";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getApiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ViewerProfileManagerProps = {
  profiles: ViewerProfile[];
  onClose: () => void;
  onProfilesChanged: () => Promise<unknown> | void;
};

/**
 * Password re-authentication is always required by the server before a profile
 * PIN changes. This panel only collects the minimum fields for that request;
 * it never displays, stores, or retains a PIN after submission.
 */
export function ViewerProfileManager({
  profiles,
  onClose,
  onProfilesChanged,
}: ViewerProfileManagerProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    profiles[0]?.id ?? null,
  );
  const [accountPassword, setAccountPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [removePin, setRemovePin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  useEffect(() => {
    if (!selectedProfile && profiles[0]) setSelectedId(profiles[0].id);
  }, [profiles, selectedProfile]);

  const submitPinChange = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !selectedProfile ||
      !accountPassword ||
      (!removePin && newPin.length < 4)
    )
      return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        getApiUrl(`/api/me/profiles/${selectedProfile.id}/pin`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: accountPassword,
            newPin: removePin ? null : newPin,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Unable to update this profile PIN.");

      setAccountPassword("");
      setNewPin("");
      setRemovePin(false);
      setSuccess(
        removePin
          ? "Profile PIN removed. Select the profile again to continue."
          : "Profile PIN saved. Select the profile again to continue.",
      );
      await onProfilesChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update this profile PIN.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative z-10 min-h-[calc(100vh-3.5rem)] bg-[#08090d] px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
      <main className="relative mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.04] px-4 text-sm font-black text-white/80 transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to profiles
        </button>
        <div className="mt-7 max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
            Kryv Cinema
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Manage profile protection
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            A profile PIN protects a personal viewing space within your
            signed-in account. Changing or removing a PIN requires your account
            password again and clears the active profile selection.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(340px,1.2fr)]">
          <section
            aria-label="Select a viewer profile"
            className="rounded-3xl border border-white/[0.1] bg-white/[0.03] p-4 sm:p-5"
          >
            <h2 className="text-sm font-black text-white">Your profiles</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
              {profiles.map((profile) => {
                const selected = profile.id === selectedProfile?.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(profile.id);
                      setError(null);
                      setSuccess(null);
                    }}
                    aria-pressed={selected}
                    className={`rounded-2xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-primary/10" : "border-white/[0.1] bg-black/15 hover:border-primary/45"}`}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-primary/25 to-indigo-500/25">
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white/80">
                          {profile.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      {profile.isLocked && (
                        <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white">
                          <LockKeyhole className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <span className="mt-2 block truncate text-sm font-black text-white">
                      {profile.name}
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold text-white/45">
                      {profile.isLocked ? "PIN protected" : "No PIN"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-white/[0.1] bg-[#0d1118] p-5 sm:p-6">
            {selectedProfile ? (
              <form onSubmit={submitPinChange}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">
                      {selectedProfile.isLocked
                        ? "Change profile PIN"
                        : "Set a profile PIN"}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">
                      For {selectedProfile.name}. PINs are hashed server-side
                      and cannot be recovered or displayed.
                    </p>
                  </div>
                </div>
                <label
                  htmlFor="account-password"
                  className="mt-6 block text-xs font-black uppercase tracking-[0.13em] text-white/65"
                >
                  Account password
                </label>
                <input
                  id="account-password"
                  type="password"
                  value={accountPassword}
                  onChange={(event) => setAccountPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  className="mt-2 h-12 w-full rounded-xl border border-white/[0.13] bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary focus:ring-2 focus:ring-primary/35"
                  placeholder="Confirm your account password"
                  required
                />
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.1] bg-black/15 p-3 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={removePin}
                    onChange={(event) => {
                      setRemovePin(event.target.checked);
                      setNewPin("");
                    }}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block font-black text-white">
                      Remove this profile PIN
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-white/45">
                      This requires account-password confirmation and clears any
                      active profile selection.
                    </span>
                  </span>
                </label>
                {!removePin && (
                  <>
                    <label
                      htmlFor="new-profile-pin"
                      className="mt-5 block text-xs font-black uppercase tracking-[0.13em] text-white/65"
                    >
                      New 4–8 digit PIN
                    </label>
                    <input
                      id="new-profile-pin"
                      type="password"
                      value={newPin}
                      onChange={(event) =>
                        setNewPin(
                          event.target.value.replace(/\D/g, "").slice(0, 8),
                        )
                      }
                      inputMode="numeric"
                      autoComplete="new-password"
                      pattern="[0-9]*"
                      minLength={4}
                      maxLength={8}
                      className="mt-2 h-12 w-full rounded-xl border border-white/[0.13] bg-black/25 px-4 text-center font-mono text-lg tracking-[0.35em] text-white outline-none placeholder:tracking-normal placeholder:text-white/30 focus:border-primary focus:ring-2 focus:ring-primary/35"
                      placeholder="PIN"
                      required
                    />
                  </>
                )}
                {error && (
                  <p
                    className="mt-4 rounded-xl border border-red-300/20 bg-red-400/[0.07] px-3 py-2 text-xs font-semibold text-red-100"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                {success && (
                  <p
                    className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.07] px-3 py-2 text-xs font-semibold text-emerald-100"
                    role="status"
                  >
                    {success}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    !accountPassword ||
                    (!removePin && newPin.length < 4)
                  }
                  className="mt-6 min-h-11 w-full font-black"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Securing
                      profile…
                    </>
                  ) : removePin ? (
                    "Remove PIN"
                  ) : selectedProfile.isLocked ? (
                    "Update PIN"
                  ) : (
                    "Set PIN"
                  )}
                </Button>
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-white/40">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{" "}
                  Profile selection uses a short-lived HttpOnly session grant.
                  Kryv never saves the selected profile ID or PIN in browser
                  storage.
                </p>
              </form>
            ) : (
              <p className="text-sm text-white/55">
                Create a profile first, then return here to protect it.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
