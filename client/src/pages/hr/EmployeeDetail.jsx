import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [sections, setSections] = useState([]);
  const [tab, setTab] = useState("progress");
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activity, setActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [detailsForm, setDetailsForm] = useState(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [empRes, secRes] = await Promise.all([
          api.get(`/hr/employees/${id}`),
          api.get(`/hr/employees/${id}/sections`)
        ]);
        if (!cancelled) {
          setEmployee(empRes.data);
          setSections(secRes.data);
        }
      } catch(e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    };

    const pollSections = async () => {
      try {
        const secRes = await api.get(`/hr/employees/${id}/sections`);
        if (!cancelled) setSections(secRes.data);
      } catch(e) {}
    };

    fetchAll();
    const interval = setInterval(pollSections, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  useEffect(() => {
    if (tab !== "log" || activity !== null) return;
    let cancelled = false;
    setActivityLoading(true);
    api.get(`/hr/employees/${id}/activity`)
      .then(res => { if (!cancelled) setActivity(res.data); })
      .catch(() => { if (!cancelled) setActivity([]); })
      .finally(() => { if (!cancelled) setActivityLoading(false); });
    return () => { cancelled = true; };
  }, [tab, id, activity]);

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsError("");
    try {
      await api.put(`/hr/employees/${id}/details`, detailsForm);
      const empRes = await api.get(`/hr/employees/${id}`);
      setEmployee(empRes.data);
      setDetailsForm(null);
    } catch (err) {
      setDetailsError(err.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try { await api.post(`/hr/employees/${id}/resend`); alert("Link resent successfully!"); }
    catch(e) { alert("Failed to resend link."); }
    finally { setResending(false); }
  };

  const readBlobError = async (err) => {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        return JSON.parse(text).message;
      } catch {}
    }
    return err.response?.data?.message || null;
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/hr/employees/${id}/generate-pdf`);
      alert(res.data.message || "PDF generated successfully.");
    } catch (err) {
      const msg = err.response?.data?.message || "PDF generation failed.";
      alert(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/hr/employees/${id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data); // res.data is already a Blob
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${(employee?.name || "employee").replace(/[^a-zA-Z0-9]/g,"_")}_Onboarding_Packet.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = await readBlobError(err) || "PDF not ready. Click 'Generate PDF' first.";
      alert(msg);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen bg-surface"><HRSidebar />
      <main className="ml-64 flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    </div>
  );

  const progress = sections.length ? Math.round(sections.filter(s=>s.signed).length/sections.length*100) : 0;

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8">
        {/* Back */}
        <button onClick={() => navigate("/hr/dashboard")}
          className="flex items-center gap-1.5 text-secondary hover:text-primary text-body-md mb-6 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span> Back to Employees
        </button>

        {/* Employee header */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-headline font-bold text-2xl flex-shrink-0">
              {employee?.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="font-headline font-bold text-headline-md text-on-surface">{employee?.name}</h1>
                <span className={`${employee?.status === "Active" ? "badge-completed" : employee?.status === "Onboarding" ? "badge-progress" : "badge-terminated"}`}>
                  {employee?.status}
                </span>
              </div>
              <p className="text-secondary text-body-md">{employee?.email}</p>
              <p className="text-secondary text-body-md">{employee?.jobTitle} · {employee?.department}</p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 max-w-48 h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{width:`${progress}%`}} />
                </div>
                <span className="text-label-md text-secondary">{sections.filter(s=>s.signed).length} of {sections.length} sections completed ({progress}%)</span>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={handleResend} disabled={resending}
                className="btn-secondary flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-xl">send</span>
                {resending ? "Sending..." : "Resend Link"}
              </button>
              <button onClick={handleGeneratePDF} disabled={generating}
                className="btn-secondary flex items-center gap-2 text-sm">
                {generating
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-xl">picture_as_pdf</span>}
                {generating ? "Generating..." : "Generate PDF"}
              </button>
              <button onClick={handleDownload} disabled={downloading}
                className="btn-primary flex items-center gap-2 text-sm">
                {downloading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-xl">download</span>}
                {downloading ? "Downloading..." : "Download PDF"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant mb-6">
          {[["progress","Section Progress"],["info","Employee Info"],["log","Activity Log"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-6 py-3 text-label-lg font-semibold border-b-2 -mb-px transition-colors ${
                tab===k ? "border-primary text-primary" : "border-transparent text-secondary hover:text-on-surface"
              }`}>{l}</button>
          ))}
        </div>

        {tab === "progress" && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  {["#","Section","Status","Signed/Initialed","Date Signed",""].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {sections.map((s, i) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 text-label-md text-secondary font-semibold">{i+1}</td>
                    <td className="px-6 py-4 text-body-md text-on-surface">{s.title}</td>
                    <td className="px-6 py-4">
                      {s.signed
                        ? <span className="badge-completed">Completed</span>
                        : <span className="badge-notstarted">Not Started</span>}
                    </td>
                    <td className="px-6 py-4">
                      {s.signed
                        ? <span className="material-symbols-outlined text-success text-xl">check_circle</span>
                        : <span className="text-secondary">—</span>}
                    </td>
                    <td className="px-6 py-4 text-body-md text-secondary">{s.dateSigned || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="material-symbols-outlined text-secondary text-xl cursor-pointer hover:text-primary">visibility</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "info" && (
          <div className="card">
            {!employee?.jobTitle && !detailsForm && (
              <div className="mb-6 p-4 bg-error-container rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-xl mt-0.5">warning</span>
                <div className="flex-1">
                  <p className="text-error text-body-md font-semibold">Employment details missing</p>
                  <p className="text-error text-body-sm mt-0.5">PDF generation will fail until these are filled in.</p>
                </div>
                <button
                  onClick={() => setDetailsForm({
                    jobTitle: "", employmentType: "Full-Time", startDate: "",
                    hourlyRate: "", overtimeRate: "", manager: "", department: "",
                    sickLeaveOption: "1", sickLeaveExemptReason: "",
                    hasEmergencyDeclaration: "no", emergencyDeclarationDetails: "",
                  })}
                  className="btn-primary text-sm flex items-center gap-1.5 flex-shrink-0">
                  <span className="material-symbols-outlined text-base">edit</span>
                  Fill In Details
                </button>
              </div>
            )}

            {detailsForm && (
              <form onSubmit={handleSaveDetails} className="mb-6 space-y-6">

                {/* Employee Info */}
                <div className="p-4 bg-surface-container-low rounded-xl">
                  <h3 className="font-headline font-semibold text-label-lg text-on-surface mb-4 pb-2 border-b border-outline-variant">
                    Employee Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-label-md text-on-surface mb-1.5">Job Title / Position *</label>
                      <select required className="input-field" value={detailsForm.jobTitle ?? ""}
                        onChange={e => setDetailsForm(f => ({ ...f, jobTitle: e.target.value }))}>
                        <option value="">Select position</option>
                        <option>NEMT Driver</option>
                        <option>EMT</option>
                        <option>Dispatcher</option>
                        <option>Office Staff</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-label-md text-on-surface mb-1.5">Employment Type *</label>
                      <select required className="input-field" value={detailsForm.employmentType ?? "Full-Time"}
                        onChange={e => setDetailsForm(f => ({ ...f, employmentType: e.target.value }))}>
                        <option>Full-Time</option>
                        <option>Part-Time</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-label-md text-on-surface mb-1.5">Department</label>
                      <select className="input-field" value={detailsForm.department ?? ""}
                        onChange={e => setDetailsForm(f => ({ ...f, department: e.target.value }))}>
                        <option value="">Select department</option>
                        <option>Operations</option>
                        <option>Dispatch</option>
                        <option>Administration</option>
                        <option>EMT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-label-md text-on-surface mb-1.5">Direct Manager</label>
                      <input placeholder="Manager name" className="input-field"
                        value={detailsForm.manager ?? ""}
                        onChange={e => setDetailsForm(f => ({ ...f, manager: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Compensation */}
                <div className="p-4 bg-surface-container-low rounded-xl">
                  <h3 className="font-headline font-semibold text-label-lg text-on-surface mb-4 pb-2 border-b border-outline-variant">
                    Compensation Details
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-label-md text-on-surface mb-1.5">Start Date *</label>
                      <input required type="date" className="input-field"
                        value={detailsForm.startDate ?? ""}
                        onChange={e => setDetailsForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-label-md text-on-surface mb-1.5">Hourly Rate ($/hr) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">$</span>
                        <input required type="number" step="0.01" min="0" placeholder="0.00"
                          className="input-field pl-7"
                          value={detailsForm.hourlyRate ?? ""}
                          onChange={e => setDetailsForm(f => ({ ...f, hourlyRate: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-label-md text-on-surface mb-1.5">Overtime Rate ($/hr) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">$</span>
                        <input required type="number" step="0.01" min="0" placeholder="0.00"
                          className="input-field pl-7"
                          value={detailsForm.overtimeRate ?? ""}
                          onChange={e => setDetailsForm(f => ({ ...f, overtimeRate: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5 — Wage Notice */}
                <div className="p-4 bg-surface-container-low rounded-xl border-l-4 border-primary">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-xl">description</span>
                    <h3 className="font-headline font-semibold text-label-lg text-on-surface">
                      Section 5 — Wage Notice (Labor Code 2810.5)
                    </h3>
                  </div>
                  <p className="text-secondary text-body-sm mb-4">Required by California law.</p>

                  <label className="block text-label-md text-on-surface mb-2 font-semibold">Paid Sick Leave Type *</label>
                  <div className="space-y-2 mb-5">
                    {[
                      { val: "1", label: "Option 1", desc: "Accrues paid sick leave only pursuant to the minimum requirements of Labor Code §245 et seq." },
                      { val: "2", label: "Option 2", desc: "Accrues paid sick leave pursuant to the employer's policy that satisfies or exceeds the requirements of Labor Code §246." },
                      { val: "3", label: "Option 3", desc: "Employer provides no less than 40 hours (or 5 days) of paid sick leave at the beginning of each 12-month period." },
                      { val: "4", label: "Option 4", desc: "The employee is exempt or partially exempt from paid sick leave by Labor Code §245.5." },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        (detailsForm.sickLeaveOption ?? "1") === opt.val
                          ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/40"
                      }`}>
                        <input type="radio" name="df_sickLeave" value={opt.val}
                          checked={(detailsForm.sickLeaveOption ?? "1") === opt.val}
                          onChange={e => setDetailsForm(f => ({ ...f, sickLeaveOption: e.target.value }))}
                          className="mt-0.5 accent-primary flex-shrink-0" />
                        <div>
                          <p className="text-label-md font-semibold text-on-surface">{opt.label}</p>
                          <p className="text-body-sm text-secondary mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {(detailsForm.sickLeaveOption ?? "1") === "4" && (
                    <div className="mb-5">
                      <label className="block text-label-md text-on-surface mb-1.5">State exemption and subsection *</label>
                      <input required placeholder="e.g. §245.5(a)(1) — construction industry employee"
                        className="input-field"
                        value={detailsForm.sickLeaveExemptReason ?? ""}
                        onChange={e => setDetailsForm(f => ({ ...f, sickLeaveExemptReason: e.target.value }))} />
                    </div>
                  )}

                  <label className="block text-label-md text-on-surface mb-2 font-semibold">Emergency or Disaster Declaration *</label>
                  <div className="space-y-2">
                    {[
                      { val: "no",  label: "No declaration",          desc: "There is no applicable state or federal emergency or disaster declaration." },
                      { val: "yes", label: "Yes — declaration applies", desc: "There is an applicable emergency or disaster declaration that may affect the employee's health and safety." },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        (detailsForm.hasEmergencyDeclaration ?? "no") === opt.val
                          ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/40"
                      }`}>
                        <input type="radio" name="df_emergency" value={opt.val}
                          checked={(detailsForm.hasEmergencyDeclaration ?? "no") === opt.val}
                          onChange={e => setDetailsForm(f => ({ ...f, hasEmergencyDeclaration: e.target.value }))}
                          className="mt-0.5 accent-primary flex-shrink-0" />
                        <div>
                          <p className="text-label-md font-semibold text-on-surface">{opt.label}</p>
                          <p className="text-body-sm text-secondary mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {(detailsForm.hasEmergencyDeclaration ?? "no") === "yes" && (
                    <div className="mt-3">
                      <label className="block text-label-md text-on-surface mb-1.5">Describe the declaration *</label>
                      <textarea required rows={3} placeholder="e.g. Sacramento County Wildfire Emergency Declaration..."
                        className="input-field resize-none"
                        value={detailsForm.emergencyDeclarationDetails ?? ""}
                        onChange={e => setDetailsForm(f => ({ ...f, emergencyDeclarationDetails: e.target.value }))} />
                    </div>
                  )}
                </div>

                {detailsError && <p className="text-error text-body-sm">{detailsError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setDetailsForm(null); setDetailsError(""); }}
                    className="btn-secondary text-sm">Cancel</button>
                  <button type="submit" disabled={savingDetails} className="btn-primary text-sm flex items-center gap-2">
                    {savingDetails && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {savingDetails ? "Saving..." : "Save Details"}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-2 gap-6">
              {[
                ["Full Name", employee?.name],
                ["Email", employee?.email],
                ["Phone Number", employee?.phone],
                ["Job Title", employee?.jobTitle],
                ["Employment Type", employee?.employmentType],
                ["Start Date", employee?.startDate ? new Date(employee.startDate).toLocaleDateString() : null],
                ["Hourly Rate", employee?.hourlyRate ? `$${employee.hourlyRate}/hr` : null],
                ["Overtime Rate", employee?.overtimeRate ? `$${employee.overtimeRate}/hr` : null],
                ["Department", employee?.department],
                ["Direct Manager", employee?.manager],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-label-md text-secondary mb-1">{label}</p>
                  <p className="text-body-md font-semibold text-on-surface">{value || "—"}</p>
                </div>
              ))}
              <div className="col-span-2 pt-4 border-t border-outline-variant">
                <p className="text-label-md text-secondary mb-1">Handbook Acknowledged</p>
                {employee?.handbookAcknowledged ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-success text-xl">check_circle</span>
                    <p className="text-body-md font-semibold text-success">
                      Yes — {employee.handbookAcknowledgedAt
                        ? new Date(employee.handbookAcknowledgedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "Date not recorded"}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-xl">cancel</span>
                    <p className="text-body-md font-semibold text-secondary">Not yet acknowledged</p>
                  </div>
                )}
              </div>
            </div>

            {employee?.jobTitle && (
              <div className="mt-4 pt-4 border-t border-outline-variant flex justify-end">
                <button onClick={() => setDetailsForm({
                    jobTitle: employee.jobTitle || "",
                    employmentType: employee.employmentType || "Full-Time",
                    startDate: employee.startDate ? employee.startDate.split("T")[0] : "",
                    hourlyRate: employee.hourlyRate || "",
                    overtimeRate: employee.overtimeRate || "",
                    manager: employee.manager || "",
                    department: employee.department || "",
                    sickLeaveOption: employee.sickLeaveOption || "1",
                    sickLeaveExemptReason: employee.sickLeaveExemptReason || "",
                    hasEmergencyDeclaration: employee.emergencyDecl ? "yes" : "no",
                    emergencyDeclarationDetails: employee.emergencyDetails || "",
                  })}
                  className="btn-secondary text-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">edit</span>
                  Edit Details
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "log" && (
          <div className="card p-0 overflow-hidden">
            {activityLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !activity?.length ? (
              <p className="text-secondary text-body-md text-center py-8">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {activity.map(a => (
                  <li key={a.id} className="px-6 py-4 flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary text-xl mt-0.5">
                      {{
                        login: "login",
                        section_signed: "task_alt",
                        pdf_generated: "picture_as_pdf",
                        termination_pdf_generated: "picture_as_pdf",
                        pdf_downloaded: "download",
                        handbook_acknowledged: "menu_book",
                        link_resent: "send",
                        employee_created: "person_add",
                      }[a.eventType] || "history"}
                    </span>
                    <div className="flex-1">
                      <p className="text-body-md text-on-surface">
                        {a.description}
                        {a.actorName && <span className="text-secondary"> — by {a.actorName}</span>}
                      </p>
                      <p className="text-label-md text-secondary mt-0.5">
                        {new Date(a.createdAt).toLocaleString("en-US", {
                          year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                        })}
                        {a.ipAddress && ` · ${a.ipAddress}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
