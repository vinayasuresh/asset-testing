import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Bot, Calendar, Clock, Copy, RefreshCw, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AIResponse } from "@shared/schema";

export default function AIResponsePage() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Extract sessionId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');

  const { data: response, isLoading, error, refetch } = useQuery<AIResponse>({
    queryKey: [`/api/ai/response/${sessionId}`],
    enabled: !!sessionId && !!user && user.role === "admin",
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Redirect if no session ID
  if (!sessionId) {
    setLocation('/dashboard');
    return null;
  }

  const copyToClipboard = async () => {
    if (!response?.response) return;

    try {
      await navigator.clipboard.writeText(response.response);
      toast({
        title: "Copied to clipboard",
        description: "AI response has been copied to your clipboard."
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard. Please select and copy manually.",
        variant: "destructive"
      });
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-semibold">Access Denied</div>
            <div className="text-muted-foreground">Admin access required for AI assistant.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar 
          title="AI Assistant Response"
          description="ITAM AI Assistant Query Results"
        />
        
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setLocation('/dashboard')}
              className="mb-4"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span>Loading AI response...</span>
                </div>
              </CardContent>
            </Card>
          ) : response ? (
            <div className="space-y-6">
              {/* Query Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-500" />
                    Your Question
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm font-medium" data-testid="text-user-query">
                      {response.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(response.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(response.createdAt).toLocaleTimeString()}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Generated
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Response Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      AI Response
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                        data-testid="button-copy-response"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading}
                        data-testid="button-refresh-response"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none dark:prose-invert">
                    <div 
                      className="whitespace-pre-wrap text-sm leading-relaxed"
                      data-testid="text-ai-response"
                    >
                      {response.response}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      onClick={() => setLocation('/dashboard')}
                      variant="outline"
                      data-testid="button-return-dashboard"
                    >
                      Return to Dashboard
                    </Button>
                    <Button
                      onClick={() => {
                        // Trigger the floating AI assistant to open again
                        setLocation('/dashboard');
                        // Note: The floating assistant will need to be manually opened by user
                      }}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      data-testid="button-ask-another"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Ask Another Question
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">Response not found</div>
                  <div className="text-muted-foreground mb-4">
                    {error ? 'Failed to fetch AI response' : 'The AI response could not be loaded.'}
                  </div>
                  <Button
                    onClick={() => setLocation('/dashboard')}
                    data-testid="button-back-to-dashboard"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}