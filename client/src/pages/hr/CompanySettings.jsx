import { useState, useEffect } from "react";
import { HRSidebar } from "../../components/layout/HRSidebar";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function CompanySettings() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/hr/settings")
      .then(r => setForm(r.data))
      .catch(() => setError("Failed to load company settings."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setSaving(true);
    try {
      await api.put("/hr/settings", form);
      setSuccess("Company settings saved successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="font-headline font-bold text-display-lg text-on-surface">Company Settings</h1>
          <p className="text-secondary text-body-md mt-1">
            This information is used in all onboarding documents — address, phone, and email fields.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card">
              <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-6 pb-3 border-b border-outline-variant">
                Company Information
              </h2>

              {!isOwner && (
                <div className="mb-4 p-3 bg-surface-container rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-xl">info</span>
                  <p className="text-secondary text-body-md">Only the Owner can edit company settings.</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-label-lg text-on-surface mb-1.5">Company Name *</label>
                  <input
                    required disabled={!isOwner}
                    className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="Angel Trans LLC"
                  />
                </div>

                <div>
                  <label className="block text-label-lg text-on-surface mb-1.5">Company Address *</label>
                  <textarea
                    required disabled={!isOwner} rows={2}
                    className="input-field resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                    value={form.address}
                    onChange={e => set("address", e.target.value)}
                    placeholder="1333 Howe Ave # 201, Sacramento, CA 95825"
                  />
                  <p className="text-label-sm text-secondary mt-1">
                    Used in onboarding documents wherever company address appears.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label-lg text-on-surface mb-1.5">Phone Number *</label>
                    <input
                      required disabled={!isOwner}
                      className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
                      value={form.phone}
                      onChange={e => set("phone", e.target.value)}
                      placeholder="(916) 259-3249"
                    />
                  </div>
                  <div>
                    <label className="block text-label-lg text-on-surface mb-1.5">HR Email *</label>
                    <input
                      required type="email" disabled={!isOwner}
                      className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
                      value={form.email}
                      onChange={e => set("email", e.target.value)}
                      placeholder="hr@angeltransllc.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="card bg-surface-container-low border border-outline-variant">
              <h3 className="font-headline font-semibold text-label-lg text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-primary">preview</span>
                Document Preview
              </h3>
              <div className="text-body-md text-secondary space-y-1">
                <p><span className="text-on-surface font-semibold">{form.name || "—"}</span></p>
                <p>{form.address || "—"}</p>
                <p>{form.phone || "—"} · {form.email || "—"}</p>
              </div>
              <p className="text-label-sm text-secondary mt-3">
                This is how company details will appear in generated onboarding PDFs.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-error-container rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-xl">error</span>
                <p className="text-error text-body-md">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 bg-success-container rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-success text-xl">check_circle</span>
                <p className="text-success text-body-md">{success}</p>
              </div>
            )}

            {isOwner && (
              <button type="submit" disabled={saving}
                className="btn-primary flex items-center gap-2">
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                ) : (
                  <><span className="material-symbols-outlined text-xl">save</span> Save Settings</>
                )}
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
