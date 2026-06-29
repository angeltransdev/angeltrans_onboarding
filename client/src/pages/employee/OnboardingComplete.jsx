import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EmployeeNav } from "../../components/layout/EmployeeNav";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function OnboardingComplete() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pdfReady, setPdfReady] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // Trigger PDF generation on mount, then poll via generate-pdf (JSON) until ready
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // poll up to 60 s (20 × 3 s)

    const poll = async () => {
      try {
        const res = await api.post("/employee/generate-pdf", {}, { timeout: 15000 });
        if (!cancelled) {
          if (res.data?.ready) {
            setPdfReady(true);
            setGenerating(false);
          } else if (attempts < maxAttempts) {
            // Generation started but not yet done — keep polling
            attempts++;
            setTimeout(poll, 3000);
          } else {
            setGenerating(false);
            setError("PDF is taking longer than expected. Click 'Download' below to try again.");
          }
        }
      } catch (err) {
        if (cancelled) return;
        const status = err.response?.status;
        const msg    = err.response?.data?.message || "";
        if (status === 400) {
          // Sections incomplete — stop polling, show message
          setGenerating(false);
          setError(msg || "Please complete all sections before downloading.");
        } else if (status >= 500) {
          // Hard generation failure — show the real server error
          setGenerating(false);
          setError(msg || "PDF generation failed. Please contact HR.");
        } else if (!status) {
          // Network error — server unreachable
          setGenerating(false);
          setError("Could not reach the server. Make sure the server is running, then refresh.");
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 3000);
        } else {
          setGenerating(false);
          setError("PDF generation failed. Please contact HR.");
        }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setPdfReady(false);
    setGenerating(true);
    setError("");
    try {
      // force=true clears the stale DB record so a fresh PDF is created
      await api.post("/employee/generate-pdf", { force: true }, { timeout: 15000 });
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (err.response?.status === 400) { setGenerating(false); setError(msg); setRegenerating(false); return; }
    }
    // Poll until the new PDF is ready
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await api.post("/employee/generate-pdf", {}, { timeout: 15000 });
        if (res.data?.ready) { setPdfReady(true); setGenerating(false); setRegenerating(false); }
        else if (attempts++ < 20) setTimeout(poll, 3000);
        else { setGenerating(false); setRegenerating(false); setError("PDF is taking longer than expected. Try downloading directly."); }
      } catch { if (attempts++ < 20) setTimeout(poll, 3000); else { setGenerating(false); setRegenerating(false); } }
    };
    poll();
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await api.get("/employee/download-packet", { responseType: "blob", timeout: 30000 });
      const url = URL.createObjectURL(res.data); // res.data is already a Blob
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${(user?.name || "employee").replace(/[^a-zA-Z0-9]/g, "_")}_Onboarding_Packet.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      let msg = "Download failed. Please try again.";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          msg = JSON.parse(text).message || msg;
        } catch {}
      } else {
        msg = err.response?.data?.message || msg;
      }
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <EmployeeNav />
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">

        {/* Success icon */}
        <div className="w-24 h-24 bg-success-container rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-success" style={{ fontSize: 48 }}>
            check_circle
          </span>
        </div>

        <h1 className="font-headline font-bold text-display-lg text-primary mb-3">
          Onboarding Complete!
        </h1>
        <p className="text-on-surface text-body-lg mb-2">
          Congratulations! You have successfully completed all 28 sections of your orientation packet.
        </p>

        {/* Email confirmation */}
        <div className="card bg-success-container border-0 mb-6 mt-6 text-left">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-success text-2xl">mark_email_read</span>
            <p className="text-success text-body-md font-semibold">
              Your signed orientation packet has been submitted. A copy will be emailed to you and HR.
            </p>
          </div>
        </div>

        {/* PDF status */}
        {generating && (
          <div className="card mb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-secondary text-body-md">Generating your signed PDF...</p>
            </div>
          </div>
        )}

        {pdfReady && !generating && (
          <div className="card bg-surface-container-low border-0 mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-success text-xl">picture_as_pdf</span>
              <p className="text-on-surface text-body-md">
                Your signed PDF is ready to download.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="card bg-error-container border-0 mb-6 text-left">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-xl">warning</span>
              <p className="text-error text-body-md">{error}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleDownload}
            disabled={downloading || generating}
            className="btn-primary flex items-center justify-center gap-2">
            {downloading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">download</span>
                {pdfReady ? "Download My Copy (PDF)" : "Generate & Download PDF"}
              </>
            )}
          </button>
          {pdfReady && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating || downloading}
              className="btn-secondary flex items-center justify-center gap-2">
              {regenerating
                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-xl">refresh</span>}
              {regenerating ? "Regenerating..." : "Regenerate PDF"}
            </button>
          )}
          <button
            onClick={() => navigate("/onboarding")}
            className="btn-secondary flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-xl">dashboard</span>
            Return to Dashboard
          </button>
        </div>

        <p className="text-secondary text-body-md mt-8">
          Thank you for completing your onboarding with Angel Trans LLC.
        </p>
      </div>
    </div>
  );
}
