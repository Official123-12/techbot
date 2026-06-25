import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  showToast: () => {},
  removeToast: () => {}
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300 min-w-[300px] max-w-[400px] ${
              toast.type === "success" ? "bg-green-950/90 border-green-700 text-green-100" :
              toast.type === "error" ? "bg-red-950/90 border-red-700 text-red-100" :
              "bg-blue-950/90 border-blue-700 text-blue-100"
            }`}
          >
            {toast.type === "success" && <CheckCircle className="w-5 h-5 shrink-0 text-green-400" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />}
            {toast.type === "info" && <Info className="w-5 h-5 shrink-0 text-blue-400" />}
            <span className="text-sm flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
