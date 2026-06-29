import logo from '../../assets/logo.png';
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role === "employee") navigate("/onboarding");
      else navigate("/hr/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Angel Trans LLC" className="h-20 object-contain mb-2" />
          <div className="mt-3 px-3 py-1 bg-primary-light rounded-full">
            <p className="text-primary text-label-md font-semibold">Employee Portal</p>
          </div>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-1">Sign In</h2>
          <p className="text-secondary text-body-md mb-6">Complete your onboarding securely online.</p>

          {error && (
            <div className="mb-4 p-3 bg-error-container rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-xl">error</span>
              <p className="text-error text-body-md">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-label-lg text-on-surface mb-1.5">Email Address</label>
              <input type="email" required placeholder="name@example.com"
                className="input-field"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-label-lg text-on-surface">Password</label>
                <Link to="/forgot-password" className="text-label-md text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input type={showPass ? "text" : "password"} required placeholder="Enter your password"
                  className="input-field pr-12"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-xl">
                    {showPass ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-secondary text-base">lock</span>
          <p className="text-label-md text-secondary">Secure employee document portal</p>
        </div>
      </div>
    </div>
  );
}
