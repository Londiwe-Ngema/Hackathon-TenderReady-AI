import { CheckCircle2, ClipboardCheck, MessageSquareText, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { confirmSignUp, resendCode, signIn, signUp } from "../lib/auth";
import { demoMode } from "../lib/config";
import { Logo } from "../components/ui";

type Mode = "signin" | "signup" | "confirm";

const FEATURES = [
  { icon: <Users className="h-5 w-5" />, title: "One advisor, dozens of SMMEs", text: "Manage every client's tenders from a single hub dashboard." },
  { icon: <ClipboardCheck className="h-5 w-5" />, title: "Compliance checklists", text: "CSD, SARS TCS, B-BBEE, SBD/MBD forms and CIDB, all pulled from the tender itself." },
  { icon: <MessageSquareText className="h-5 w-5" />, title: "Ask the tender", text: "Answers based on the document, with page references you can check." },
];

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(demoMode ? "advisor@hub.example" : "");
  const [password, setPassword] = useState(demoMode ? "DemoPassword1" : "");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        if ((await signIn(email, password)) === "confirm") {
          await resendCode(email);
          setMode("confirm");
          setInfo("Please confirm your email address. We've sent you a new code.");
        } else onSignedIn();
      } else if (mode === "signup") {
        if ((await signUp(email, password, name)) === "confirm") {
          setMode("confirm");
          setInfo(`We've emailed a verification code to ${email}.`);
        } else onSignedIn();
      } else {
        await confirmSignUp(email, code);
        await signIn(email, password);
        onSignedIn();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-2 bg-brand-600" />
      <header className="bg-white shadow-[0_0_20px_rgba(21,47,95,0.2)]">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:py-16">
          <section className="order-2 lg:order-1">
            <h1 className="title-rule text-[30px] leading-tight text-navy-900">Tender compliance for SMME hubs</h1>
            <p className="mt-6 max-w-xl text-[15px] leading-7">
              Help the businesses you support submit complete, compliant bids and avoid disqualification. Upload a tender and get a
              summary, a submission checklist and a list of risks, with page references back to the original document.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="card p-5">
                  <span className="inline-flex bg-brand-600 p-2.5 text-white">{f.icon}</span>
                  <p className="mt-4 font-nav text-sm font-bold uppercase tracking-wide text-navy-900">{f.title}</p>
                  <p className="mt-2 text-sm leading-6">{f.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="order-1 lg:order-2">
            <div className="card border-t-4 border-t-accent-500">
              <div className="border-b border-[#dfe3e4] px-6 py-5">
                <h2 className="text-xl uppercase text-navy-900">
                  {mode === "signin" ? "Sign in to your hub" : mode === "signup" ? "Register a hub account" : "Verify your email"}
                </h2>
                <p className="mt-1 text-sm">
                  {mode === "signup" ? "For advisors at incubators, enterprise development programmes and business support centres." : mode === "confirm" ? "Enter the 6-digit code from your inbox." : "Welcome back."}
                </p>
              </div>
              <div className="px-6 pb-6 pt-2">
                {demoMode && (
                  <p className="mt-4 border-l-4 border-accent-500 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Demo mode: any email and password will sign you in.
                  </p>
                )}

                <form onSubmit={submit} className="mt-6 space-y-4">
                  {mode === "signup" && (
                    <div>
                      <label className="label" htmlFor="name">Your name</label>
                      <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                    </div>
                  )}
                  {mode !== "confirm" && (
                    <>
                      <div>
                        <label className="label" htmlFor="email">Work email</label>
                        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                      </div>
                      <div>
                        <label className="label" htmlFor="password">Password</label>
                        <input
                          id="password"
                          type="password"
                          className="input"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={10}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        />
                        {mode === "signup" && <p className="mt-1 text-xs text-slate-500">At least 10 characters with upper case, lower case and a number.</p>}
                      </div>
                    </>
                  )}
                  {mode === "confirm" && (
                    <div>
                      <label className="label" htmlFor="code">Verification code</label>
                      <input id="code" className="input tracking-widest" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="one-time-code" />
                    </div>
                  )}

                  {info && (
                    <p className="flex items-center gap-2 text-sm text-ok-600">
                      <CheckCircle2 className="h-4 w-4" /> {info}
                    </p>
                  )}
                  {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

                  <button type="submit" className="btn-primary w-full" disabled={busy}>
                    {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Register" : "Verify and sign in"}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600">
                  {mode === "signin" ? (
                    <>
                      New to TenderReady?{" "}
                      <button className="font-medium text-brand-600 hover:underline" onClick={() => setMode("signup")}>Create an account</button>
                    </>
                  ) : mode === "signup" ? (
                    <>
                      Already registered?{" "}
                      <button className="font-medium text-brand-600 hover:underline" onClick={() => setMode("signin")}>Sign in</button>
                    </>
                  ) : (
                    <button className="font-medium text-brand-600 hover:underline" onClick={() => resendCode(email).then(() => setInfo("A new code has been sent."))}>
                      Resend code
                    </button>
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

    </div>
  );
}
