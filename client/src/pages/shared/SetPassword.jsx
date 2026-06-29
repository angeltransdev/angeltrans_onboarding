import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../../services/api";
import logo from "../../assets/logo.png";

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";
  const isInviteFlow = location.pathname === "/set-password";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This link is missing a token. Please request a new link.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (isInviteFlow) {
        const { data } = await api.post("/auth/set-password", { token, password });
        localStorage.setItem("at_token", data.token);
        api.defaults.headers.common.Authorization = `Bearer ${data.token}`;

        const decoded = jwtDecode(data.token);
        navigate(decoded.role === "employee" ? "/onboarding" : "/hr/dashboard", { replace: true });
        return;
      }

      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to process this request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Angel Trans LLC" className="h-16 object-contain mb-2" />
        </div>

        <div className="card">
          <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-1">
            {isInviteFlow ? "Create your password" : "Reset your password"}
          </h2>
          <p className="text-secondary text-body-md mb-6">
            {isInviteFlow
              ? "Set your account password to access the portal."
              : "Choose a new password for your account."}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-error-container rounded-lg">
              <p className="text-error text-body-md">{error}</p>
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Submitting..." : isInviteFlow ? "Set Password" : "Reset Password"}
              </button>
            </form>
          ) : (
            <div className="text-center py-2">
              <p className="text-body-md text-on-surface mb-4">Your password was reset successfully.</p>
              <Link to="/login" className="btn-primary inline-block">
                Go to Sign In
              </Link>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-primary text-label-lg hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
