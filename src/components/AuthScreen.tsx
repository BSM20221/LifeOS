import { ArrowLeft, ArrowRight, MailCheck, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getFriendlyError } from "../utils";
import { StatusBanner } from "./Common";

type AuthMode = "login" | "signup" | "reset";

export function AuthScreen({ onTryDemo }: { onTryDemo?: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const cleanName = displayName.trim();
        if (cleanName) {
          await updateProfile(credential.user, { displayName: cleanName });
        }

        await setDoc(
          doc(db, "users", credential.user.uid),
          {
            email: credential.user.email ?? email.trim(),
            displayName: cleanName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await sendEmailVerification(credential.user);
        window.localStorage.setItem("lifeos-onboarding-pending", "1");
        setNotice("Verification email sent. Open your inbox and click the link before using LifeOS.");
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice("Password reset email sent. Check your inbox for the reset link.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (authError) {
      if (mode === "reset" && getFriendlyError(authError) === "The email or password does not match an account.") {
        setNotice("If that email has a LifeOS account, a reset link was sent.");
      } else {
        setError(getFriendlyError(authError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <img src="/lifeos-mark.svg" alt="" className="brand-mark" />
          <div>
            <p className="eyebrow">Secure workspace</p>
            <h1>LifeOS v2</h1>
          </div>
        </div>

        <div className="auth-copy">
          <h2>
            {mode === "login"
              ? "Log in to your LifeOS."
              : mode === "reset"
                ? "Reset your password."
                : "Create your LifeOS account."}
          </h2>
          <p>
            {mode === "signup"
              ? "Use a real inbox. LifeOS sends a verification link before opening your workspace."
              : "Tasks and projects stay private inside your signed-in workspace."}
          </p>
        </div>

        {onTryDemo ? (
          <section className="auth-demo-card" aria-label="Try LifeOS demo">
            <div>
              <p className="eyebrow">Portfolio demo</p>
              <strong>Explore without an email</strong>
              <span>Open a sample workspace with tasks, projects, focus, insights, and weekly review.</span>
            </div>
            <button className="secondary-button" type="button" onClick={onTryDemo}>
              Try demo
            </button>
          </section>
        ) : null}

        <div className="segmented-control" aria-label="Account mode">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => switchMode("login")}>
            Login
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => switchMode("signup")}>
            Signup
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <label>
              Name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Optional" />
            </label>
          ) : null}

          <label>
            Email
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          {mode !== "reset" ? (
            <label>
              Password
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
          ) : null}

          {error ? <StatusBanner tone="error" message={error} /> : null}
          {notice ? <StatusBanner tone="success" message={notice} /> : null}

          <button className="primary-button full-width" disabled={submitting} type="submit">
            <ArrowRight size={18} />
            {submitting ? "Working..." : mode === "login" ? "Login" : mode === "reset" ? "Send reset link" : "Create account"}
          </button>

          {mode === "login" ? (
            <button className="auth-inline-link" type="button" onClick={() => switchMode("reset")}>
              Forgot password?
            </button>
          ) : null}

          {mode === "reset" ? (
            <button className="auth-inline-link" type="button" onClick={() => switchMode("login")}>
              <ArrowLeft size={15} />
              Back to login
            </button>
          ) : null}
        </form>

        <div className="auth-links" aria-label="Legal links">
          <a href="#privacy">Privacy</a>
          <span aria-hidden="true">|</span>
          <a href="#terms">Terms</a>
        </div>
      </section>
    </main>
  );

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    if (nextMode === "reset") {
      setPassword("");
    }
  }
}

export function EmailVerificationScreen({ user, onVerified }: { user: User; onVerified: () => void }) {
  const [busy, setBusy] = useState<"checking" | "sending" | "">("");
  const [message, setMessage] = useState("Check your inbox and click the verification link we sent.");
  const [error, setError] = useState("");

  async function resendVerification() {
    setBusy("sending");
    setError("");
    setMessage("");
    try {
      await sendEmailVerification(user);
      setMessage("Verification email sent again. Check your inbox and spam folder.");
    } catch (sendError) {
      setError(getFriendlyError(sendError));
    } finally {
      setBusy("");
    }
  }

  async function checkVerification() {
    setBusy("checking");
    setError("");
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        setMessage("Email verified. Opening LifeOS...");
        onVerified();
      } else {
        setMessage("Still waiting for verification. Click the email link, then check again.");
      }
    } catch (checkError) {
      setError(getFriendlyError(checkError));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel verification-panel">
        <div className="brand-row">
          <img src="/lifeos-mark.svg" alt="" className="brand-mark" />
          <div>
            <p className="eyebrow">Email verification</p>
            <h1>LifeOS v2</h1>
          </div>
        </div>

        <div className="auth-copy">
          <MailCheck size={30} />
          <h2>Verify your email to continue.</h2>
          <p>
            LifeOS needs a verified email before opening your private workspace. This prevents fake or mistyped email accounts from saving data.
          </p>
        </div>

        <dl className="verification-summary">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Not verified yet</dd>
          </div>
        </dl>

        {message ? <StatusBanner tone="info" message={message} /> : null}
        {error ? <StatusBanner tone="error" message={error} /> : null}

        <div className="settings-actions-row">
          <button className="primary-button" type="button" onClick={() => void checkVerification()} disabled={Boolean(busy)}>
            <RefreshCw size={17} />
            {busy === "checking" ? "Checking..." : "I verified my email"}
          </button>
          <button className="secondary-button" type="button" onClick={() => void resendVerification()} disabled={Boolean(busy)}>
            {busy === "sending" ? "Sending..." : "Resend email"}
          </button>
        </div>

        <button className="auth-inline-link" type="button" onClick={() => void signOut(auth)}>
          Use a different account
        </button>
      </section>
    </main>
  );
}
