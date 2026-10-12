import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { passkeyProof, registerPasskey, securityRequest } from "../../api/security.ts";
import { SettingsCard, SettingBlock } from "./ui.tsx";
interface SecurityStatus { totpEnabled: boolean; passkeysEnabled: boolean; emailReauthEnabled?: boolean; recoveryCodesRemaining: number; passkeys: { id: string; name: string; created_at: string }[] }
const confirmationRequired = Symbol("confirmationRequired");
export function SecuritySettings() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SecurityStatus>();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [usePasskey, setUsePasskey] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [setup, setSetup] = useState<{ challengeId: string; secret: string; qr: string }>();
  const [recovery, setRecovery] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(true);
  const identityId = useId();
  const proofInput = useRef<HTMLInputElement>(null);
  const focusProof = useRef(false);
  const load = async () => {
    const result = await securityRequest<SecurityStatus>("/", undefined, "GET");
    setStatus(result);
    if (!result.passkeys.length) setUsePasskey(false);
  };
  useEffect(() => { void load().catch(() => setError(t("security.failed"))); }, [t]);
  useEffect(() => {
    if (identityOpen && !busy && focusProof.current) { focusProof.current = false; proofInput.current?.focus(); }
  }, [identityOpen, busy]);
  async function run(action: () => Promise<void>, clear = true, message = "security.updated") {
    setBusy(true); setError(""); setSuccess("");
    let completed = false;
    try {
      await action(); completed = true;
      if (clear) {
        setPassword(""); setCode(""); setEmailCode(""); setEmailSent(false);
        setIdentityOpen(false); setSuccess(t(message));
      }
      await load();
    }
    catch (failure) {
      if (failure !== confirmationRequired) setError(t(completed && clear ? "security.refreshFailed" : failure instanceof Error && failure.message === "last_passkey" ? "security.lastPasskey" : "security.failed"));
    }
    finally { setBusy(false); }
  }
  async function proof() {
    if (usePasskey) return passkeyProof();
    if (!identityOpen) {
      focusProof.current = true; setIdentityOpen(true);
      throw confirmationRequired;
    }
    const result = await securityRequest<{ reauthToken: string }>(emailSent ? "/reauth/email/confirm" : "/reauth", { password, code, emailCode });
    return result.reauthToken;
  }
  if (!status) return error ? <p role="alert">{error}</p> : null;
  return <SettingsCard title={t("security.title")} description={t("security.intro")}>
    <SettingBlock>
      {success && <p role="status" className="text-sm text-[var(--c-green3)] mb-3">{success}</p>}
      {error && <p role="alert" className="text-sm text-danger mb-3">{error}</p>}
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium" aria-expanded={identityOpen} aria-controls={identityId} disabled={busy} onClick={() => setIdentityOpen(!identityOpen)}>
        {t("security.confirmIdentity")}
        <svg className={`h-4 w-4 shrink-0 transition-transform ${identityOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div id={identityId} hidden={!identityOpen} className="mt-3">{identityOpen && <>
        <p className="text-sm text-[var(--c-text-muted)] mb-3">{t("security.reauth")}</p>
        {!!status.passkeys.length && <label className="flex items-center gap-2 mb-3 text-sm"><input type="checkbox" checked={usePasskey} disabled={busy} onChange={event => setUsePasskey(event.target.checked)} />{t("security.usePasskey")}</label>}
        {!usePasskey && <div className="flex flex-col gap-3">
          {!emailSent && <input ref={proofInput} className="input" type="password" autoComplete="current-password" disabled={busy} value={password} onChange={event => setPassword(event.target.value)} aria-label={t("security.password")} placeholder={t("security.password")} />}
          {status.totpEnabled && <input className="input" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} aria-label={t("security.code")} placeholder={t("security.code")} />}
          {status.emailReauthEnabled && !emailSent && <button className="btn-secondary self-start" disabled={busy} onClick={() => void run(async () => { await securityRequest("/reauth/email", {}); setEmailSent(true); }, false)}>{t("security.sendEmail")}</button>}
          {emailSent && <input ref={proofInput} className="input" autoComplete="one-time-code" value={emailCode} onChange={event => setEmailCode(event.target.value)} aria-label={t("security.emailCode")} placeholder={t("security.emailCode")} />}
        </div>}
      </>}</div>
    </SettingBlock>
    <SettingBlock>
      <h3 className="font-semibold mb-3">{t("security.passkeys")}</h3>
      {!!status.passkeys.length && <ul className="mb-4 divide-y divide-[var(--c-border)] rounded-xl border border-[var(--c-border)]">
        {status.passkeys.map(key => <li key={key.id} className="flex items-center justify-between gap-3 px-4 py-3"><span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-sm font-medium">{key.name}</span><button type="button" className="btn-secondary shrink-0 text-sm" disabled={busy} aria-label={t("security.removeNamed", { name: key.name })} onClick={() => void run(async () => { await securityRequest(`/passkeys/${encodeURIComponent(key.id)}`, { reauthToken: await proof() }, "DELETE"); }, true, "security.passkeyRemoved")}>{t("security.remove")}</button></li>)}
      </ul>}
      {status.passkeysEnabled ? <form className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={event => { event.preventDefault(); if (!busy && name.trim()) void run(async () => { await registerPasskey(await proof(), name.trim()); setName(""); }, true, "security.passkeyAdded"); }}>
        <label className="min-w-0 text-sm font-medium">{t("security.passkeyName")}<input className="input mt-2" value={name} maxLength={100} disabled={busy} onChange={event => setName(event.target.value)} placeholder={t("security.passkeyName")} /></label>
        <button type="submit" className="btn-primary whitespace-nowrap" disabled={busy || !name.trim()}>{t("security.addPasskey")}</button>
      </form> : <p>{t("security.httpsRequired")}</p>}
    </SettingBlock>
    <SettingBlock>
      <h3 className="font-semibold mb-3">{t("security.twoFactor")}</h3>
      <p className="text-sm mb-3">{t(status.totpEnabled ? "security.enabled" : "security.disabled")}</p>
      <p className="text-sm mb-3">{t("security.revocationHint")}</p>
      {!setup && <button className="btn-secondary" disabled={busy || recovery.length > 0} onClick={() => void run(async () => {
        const reauthToken = await proof();
        if (status.totpEnabled) { await securityRequest("/totp/disable", { reauthToken }); }
        else { const result = await securityRequest<{ challengeId: string; secret: string; uri: string }>("/totp/setup", { reauthToken }); setSetup({ ...result, qr: await QRCode.toDataURL(result.uri) }); }
      }, true, status.totpEnabled ? "security.updated" : "security.authenticatorStarted")}>{t(status.totpEnabled ? "security.disable" : "security.enable")}</button>}
      {setup && <div className="flex flex-col gap-3 mt-3"><p>{t("security.scan")}</p><img src={setup.qr} alt={t("security.qrAlt")} width={200} height={200} /><code className="break-all select-all">{setup.secret}</code><input className="input" value={code} autoComplete="one-time-code" inputMode="numeric" onChange={event => setCode(event.target.value)} aria-label={t("security.code")} placeholder={t("security.code")} /><div className="flex gap-3"><button className="btn-primary" disabled={busy} onClick={() => void run(async () => { const result = await securityRequest<{ recoveryCodes: string[] }>("/totp/confirm", { challengeId: setup.challengeId, code }); setRecovery(result.recoveryCodes); setSetup(undefined); })}>{t("security.confirm")}</button><button className="btn-secondary" disabled={busy} onClick={() => { setSetup(undefined); setCode(""); }}>{t("security.cancel")}</button></div></div>}
      {status.totpEnabled && !recovery.length && <button className="btn-secondary ml-3" disabled={busy} onClick={() => void run(async () => { const result = await securityRequest<{ recoveryCodes: string[] }>("/recovery-codes", { reauthToken: await proof() }); setRecovery(result.recoveryCodes); })}>{t("security.newRecovery")}</button>}
      {!!recovery.length && <div className="mt-4" role="status"><p className="mb-3">{t("security.saveRecovery")}</p><pre className="select-all whitespace-pre-wrap">{recovery.join("\n")}</pre><button className="btn-secondary mt-3" onClick={() => setRecovery([])}>{t("security.saved")}</button></div>}
    </SettingBlock>
  </SettingsCard>;
}
