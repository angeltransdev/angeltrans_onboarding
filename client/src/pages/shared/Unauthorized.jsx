import logo from '../../assets/logo.png';
import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-error-container rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-error" style={{fontSize:48}}>lock</span>
        </div>
        <h1 className="font-headline font-bold text-headline-md text-on-surface mb-2">Access Restricted</h1>
        <p className="text-secondary text-body-lg mb-8">
          This portal is not available to you. If you believe this is a mistake, please contact HR.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate("/login")} className="btn-secondary">Back to Sign In</button>
          <a href="mailto:hr@angeltrans.com" className="btn-primary">Contact HR</a>
        </div>
      </div>
    </div>
  );
}
