import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getAdminPanels } from "@/lib/api";
import { PageLoader } from "@/components/PageLoader";
import { Server, ArrowLeft, ExternalLink, Calendar, User, RefreshCw } from "lucide-react";

interface Panel {
  _id: string;
  planName: string;
  panelUsername: string;
  panelLoginUrl: string;
  purchasedAt: string;
  ownerEmail: string;
  ownerUsername: string;
  txCost: number;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MyPanels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchPanels();
  }, [user, navigate]);

  const fetchPanels = async () => {
    setLoading(true);
    try {
      const data = await getAdminPanels() as Panel[];
      if (Array.isArray(data)) {
        setPanels(data);
      }
    } catch {
      showToast("Failed to load panels", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-sm sm:text-base">My Panels</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-400" />
            Your Purchased Panels
          </h2>
          <Button variant="outline" size="sm" onClick={fetchPanels}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>

        {panels.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">You haven't purchased any panels yet.</p>
            <Button
              className="mt-4"
              onClick={() => navigate("/panel-plans")}
            >
              Browse Panel Plans
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {panels.map(p => (
              <Card key={p._id} className="hover:border-purple-500/30 transition-all">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{p.planName}</span>
                    <span className="text-xs font-mono text-purple-400">{p.txCost} SQ</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Username:</span>
                    <span className="font-mono">{p.panelUsername}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Purchased:</span>
                    <span>{formatDate(p.purchasedAt)}</span>
                  </div>
                  {p.panelLoginUrl && (
                    <Button
                      size="sm"
                      className="w-full mt-2 gap-2"
                      onClick={() => window.open(p.panelLoginUrl, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Login to Panel
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}