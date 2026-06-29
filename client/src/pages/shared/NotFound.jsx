import logo from '../../assets/logo.png';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const handleBack = () => navigate(user?.role === "employee" ? "/onboarding" : user ? "/hr/dashboard" : "/login");

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-secondary" style={{fontSize:48}}>directions_car</span>
        </div>
        <h1 className="font-headline font-bold text-8xl text-primary mb-4">404</h1>
        <h2 className="font-headline font-semibold text-headline-md text-on-surface mb-2">Page Not Found</h2>
        <p className="text-secondary text-body-lg mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <button onClick={handleBack} className="btn-primary">Go to Dashboard</button>
      </div>
    </div>
  );
}
