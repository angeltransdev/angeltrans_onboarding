import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

// Shared
import Login from "./pages/shared/Login";
import ForgotPassword from "./pages/shared/ForgotPassword";
import SetPassword from "./pages/shared/SetPassword";
import NotFound from "./pages/shared/NotFound";
import Unauthorized from "./pages/shared/Unauthorized";

// Employee
import OnboardingDashboard from "./pages/employee/OnboardingDashboard";
import SectionSigning from "./pages/employee/SectionSigning";
import OnboardingComplete from "./pages/employee/OnboardingComplete";
import TerminationSigning from "./pages/employee/TerminationSigning";
import TerminationComplete from "./pages/employee/TerminationComplete";

// HR
import HRDashboard from "./pages/hr/HRDashboard";
import EmployeeDetail from "./pages/hr/EmployeeDetail";
import SendOnboarding from "./pages/hr/SendOnboarding";
import InitiateTermination from "./pages/hr/InitiateTermination";
import TerminatedEmployees from "./pages/hr/TerminatedEmployees";
import DocumentLibrary from "./pages/hr/DocumentLibrary";
import AdminManagement from "./pages/hr/AdminManagement";

const EMP = ["employee"];
const HR  = ["hr_admin", "owner"];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/reset-password" element={<SetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Employee */}
          <Route path="/onboarding" element={<ProtectedRoute roles={EMP}><OnboardingDashboard /></ProtectedRoute>} />
          <Route path="/onboarding/section/:sectionId" element={<ProtectedRoute roles={EMP}><SectionSigning /></ProtectedRoute>} />
          <Route path="/onboarding/complete" element={<ProtectedRoute roles={EMP}><OnboardingComplete /></ProtectedRoute>} />
          <Route path="/termination" element={<ProtectedRoute roles={EMP}><TerminationSigning /></ProtectedRoute>} />
          <Route path="/termination/complete" element={<ProtectedRoute roles={EMP}><TerminationComplete /></ProtectedRoute>} />

          {/* HR */}
          <Route path="/hr/dashboard" element={<ProtectedRoute roles={HR}><HRDashboard /></ProtectedRoute>} />
          <Route path="/hr/employees/:id" element={<ProtectedRoute roles={HR}><EmployeeDetail /></ProtectedRoute>} />
          <Route path="/hr/send-onboarding" element={<ProtectedRoute roles={HR}><SendOnboarding /></ProtectedRoute>} />
          <Route path="/hr/initiate-termination" element={<ProtectedRoute roles={HR}><InitiateTermination /></ProtectedRoute>} />
          <Route path="/hr/terminations" element={<ProtectedRoute roles={HR}><TerminatedEmployees /></ProtectedRoute>} />
          <Route path="/hr/documents" element={<ProtectedRoute roles={HR}><DocumentLibrary /></ProtectedRoute>} />
          <Route path="/hr/admins" element={<ProtectedRoute roles={HR}><AdminManagement /></ProtectedRoute>} />
          <Route path="/hr/employees" element={<ProtectedRoute roles={HR}><HRDashboard /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
