import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import CheckIn from "@/pages/CheckIn";
import Trends from "@/pages/Trends";
import WeeklySummary from "@/pages/WeeklySummary";
import Privacy from "@/pages/Privacy";
import Supporter from "@/pages/Supporter";
import Clinician from "@/pages/Clinician";
import Onboarding from "@/pages/Onboarding";
import Sobriety from "@/pages/Sobriety";
import Craving from "@/pages/Craving";
import Resources from "@/pages/Resources";
import TwelveSteps from "@/pages/TwelveSteps";

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen ambient-mesh flex items-center justify-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const dest = user.role === "recovery_user" ? "/app" : user.role === "supporter" ? "/supporter" : "/clinician";
    return <Navigate to={dest} replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/app" element={<Guard roles={["recovery_user"]}><Dashboard /></Guard>} />
          <Route path="/app/onboarding" element={<Guard roles={["recovery_user"]}><Onboarding /></Guard>} />
          <Route path="/app/checkin" element={<Guard roles={["recovery_user"]}><CheckIn /></Guard>} />
          <Route path="/app/craving" element={<Guard roles={["recovery_user"]}><Craving /></Guard>} />
          <Route path="/app/sobriety" element={<Guard roles={["recovery_user"]}><Sobriety /></Guard>} />
          <Route path="/app/trends" element={<Guard roles={["recovery_user"]}><Trends /></Guard>} />
          <Route path="/app/summary" element={<Guard roles={["recovery_user"]}><WeeklySummary /></Guard>} />
          <Route path="/app/steps" element={<Guard roles={["recovery_user"]}><TwelveSteps /></Guard>} />
          <Route path="/app/resources" element={<Guard roles={["recovery_user"]}><Resources /></Guard>} />
          <Route path="/app/privacy" element={<Guard roles={["recovery_user"]}><Privacy /></Guard>} />

          <Route path="/supporter" element={<Guard roles={["supporter"]}><Supporter /></Guard>} />
          <Route path="/clinician" element={<Guard roles={["clinician"]}><Clinician /></Guard>} />
        </Routes>
        <Toaster position="top-right" theme="dark" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
