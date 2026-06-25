import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router";
  import { AuthProvider, useAuth } from "@/hooks/useAuth";
  import { ToastProvider } from "@/hooks/useToast";
  import { Login } from "@/pages/Login";
  import { Signup } from "@/pages/Signup";
  import { Dashboard } from "@/pages/Dashboard";
  import { Admin } from "@/pages/Admin";
  import TopUp from "@/pages/TopUp";
  import { Profile } from "@/pages/Profile";
  import { Docs } from "@/pages/Docs";
  import { Deploy } from "@/pages/Deploy";
  import { ServicesBots } from "@/pages/ServicesBots";
  import { ServicesPanel } from "@/pages/ServicesPanel";
  import { MyBots } from "@/pages/MyBots";
  import { PurchasePanels } from "@/pages/PurchasePanels";
  import { MyPanels } from "@/pages/MyPanels";
  import { BotDeployPage } from "@/pages/BotDeployPage";
  import { Tutorials } from "@/pages/Tutorials";
  import { Contact } from "@/pages/Contact";
  import { NotFound } from "@/pages/NotFound";
  import { PageLoader } from "@/components/PageLoader";
  import { AppBootLoader } from "@/components/AppBootLoader";
  import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

  interface NavLoadingContextType {
    navigateWithLoader: (path: string) => void;
  }

  const NavLoadingContext = createContext<NavLoadingContextType>({
    navigateWithLoader: () => {}
  });

  export function useNavLoader() {
    return useContext(NavLoadingContext);
  }

  function NavLoadingProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const navigateWithLoader = useCallback((path: string) => {
      setLoading(true);
      setTimeout(() => {
        navigate(path);
        setLoading(false);
      }, 400);
    }, [navigate]);

    if (loading) return <PageLoader />;

    return (
      <NavLoadingContext.Provider value={{ navigateWithLoader }}>
        {children}
      </NavLoadingContext.Provider>
    );
  }

  function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [pathname]);
    return null;
  }

  function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading) return <PageLoader />;
    return <Navigate to={user ? "/dashboard" : "/signup"} replace />;
  }

  function AppRoutes() {
    return (
      <NavLoadingProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/topup" element={<TopUp />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/services/bots" element={<ServicesBots />} />
          <Route path="/services/bots/:slug" element={<BotDeployPage />} />
          <Route path="/services/panels" element={<ServicesPanel />} />
          <Route path="/services/panels/mypanels" element={<MyPanels />} />
          <Route path="/services/panels/purchasepanel" element={<PurchasePanels />} />
          <Route path="/mybots" element={<MyBots />} />
          <Route path="/mypanels" element={<MyPanels />} />
          <Route path="/tutorials" element={<Tutorials />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </NavLoadingProvider>
    );
  }

  function AppBootWrapper({ children }: { children: ReactNode }) {
    const { loading } = useAuth();
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    useEffect(() => {
      const t = setTimeout(() => setMinTimeElapsed(true), 2200);
      return () => clearTimeout(t);
    }, []);

    if (loading || !minTimeElapsed) return <AppBootLoader />;
    return <>{children}</>;
  }

  function App() {
    return (
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppBootWrapper>
              <AppRoutes />
            </AppBootWrapper>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    );
  }

  export default App;
  