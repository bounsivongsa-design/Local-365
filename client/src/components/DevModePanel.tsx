import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, devModeLogin, devModeLogout } from "@/hooks/use-auth";
import { User, Building2, LogOut, Wrench } from "lucide-react";

export function DevModePanel() {
  const { user, isAuthenticated } = useAuth();

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-72 shadow-lg border-2 border-orange-400">
        <CardHeader className="py-3 bg-orange-100 dark:bg-orange-900/30">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Dev Mode Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {isAuthenticated ? (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">Logged in as:</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize">
                    {user?.accountType === "business" ? (
                      <Building2 className="h-3 w-3 mr-1" />
                    ) : (
                      <User className="h-3 w-3 mr-1" />
                    )}
                    {user?.accountType || "user"}
                  </Badge>
                  <span className="font-medium">{user?.firstName} {user?.lastName}</span>
                </div>
                {user?.accountType === "customer" && (
                  <div className="mt-2 text-xs flex flex-wrap gap-1">
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                      Tier: {user?.loyaltyTier}
                    </Badge>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                      Pts: {user?.loyaltyPoints}
                    </Badge>
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => devModeLogout()}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Dev Logout
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Quick login as test user:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => devModeLogin("customer")}
                  data-testid="button-dev-login-customer"
                >
                  <User className="h-4 w-4 mr-1" />
                  Customer
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => devModeLogin("business")}
                  data-testid="button-dev-login-business"
                >
                  <Building2 className="h-4 w-4 mr-1" />
                  Business
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
