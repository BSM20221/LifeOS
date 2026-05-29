import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getFriendlyError } from "../utils";
import { StatusBanner } from "./Common";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

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
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (authError) {
      setError(getFriendlyError(authError));
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
          <h2>{mode === "login" ? "Log in to your LifeOS." : "Create your LifeOS account."}</h2>
          <p>Tasks and projects are stored in your authenticated Firestore user space.</p>
        </div>

        <div className="segmented-control" aria-label="Authentication mode">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>
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

          {error ? <StatusBanner tone="error" message={error} /> : null}

          <button className="primary-button full-width" disabled={submitting} type="submit">
            <ArrowRight size={18} />
            {submitting ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <div className="auth-links" aria-label="Legal links">
          <a href="#privacy">Privacy</a>
          <span aria-hidden="true">|</span>
          <a href="#terms">Terms</a>
        </div>
      </section>
    </main>
  );
}
