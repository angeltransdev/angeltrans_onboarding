import logo from '../../assets/logo.png';
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

export default function ForgotPassword() {
  const [tab, setTab] = useState("forgot");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Angel Trans LLC" className="h-16 object-contain mb-2" />
        </div>

        <div className="card">
          {/* Tabs */}
          <div className="flex border-b border-outline-variant mb-6">
            {["forgot", "reset"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 pb-3 text-label-lg font-semibold transition-colors border-b-2 -mb-px ${
                  tab === t ? "border-primary text-primary" : "border-transparent text-secondary"
                }`}>
                {t === "forgot" ? "Forgot Password" : "Reset Password"}
              </button>
            ))}
          </div>

          {!sent ? (
            <>
              <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-1">
                {tab === "forgot" ? "Forgot your password?" : "Reset your password"}
              </h2>
              <p className="text-secondary text-body-md mb-6">
                Enter your email and we'll send you a link to reset it.
              </p>
              {error && (
                <div className="mb-4 p-3 bg-error-container rounded-lg">
                  <p className="text-error text-body-md">{error}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-label-lg text-on-surface mb-1.5">Email Address</label>
                  <input type="email" required placeholder="name@example.com"
                    className="input-field" value={email}
                    onChange={e => setEmail(e.target.value)} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-success-container rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-success" style={{fontSize:28}}>mark_email_read</span>
              </div>
              <h3 className="font-headline font-semibold text-headline-sm text-on-surface mb-2">Check your email</h3>
              <p className="text-secondary text-body-md">We sent a reset link to <strong>{email}</strong></p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="flex items-center justify-center gap-1.5 text-primary text-label-lg hover:underline">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
