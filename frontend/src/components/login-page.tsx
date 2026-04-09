"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, User, Info } from "lucide-react";
import * as api from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface LoginPageProps {
  onLoginSuccess: () => void;
  authInfo?: api.AuthCheckResponse;
}

export function LoginPage({ onLoginSuccess, authInfo }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("admin");
  const { t } = useTranslations();

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const info = await api.getUserInfo();
        if (info.username) {
          setUsername(info.username);
        }
      } catch {
        // 忽略错误，使用默认用户名
      }
    };
    fetchUsername();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error(t("login.enter_password"));
      return;
    }

    setLoading(true);
    try {
      const result = await api.login(password);
      toast.success(`${t("login.welcome")}，${result.username}！`);
      onLoginSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    if (authInfo?.demo_password) {
      setPassword(authInfo.demo_password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">{t("login.title")}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" />
            {t("login.sign_in_as")} <span className="font-medium text-foreground">{username}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authInfo?.demo_mode && (
            <div
              className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
              onClick={handleDemoFill}
            >
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t("login.demo_mode")}</p>
                <p className="mt-0.5 text-blue-600 dark:text-blue-400">
                  账号：<code className="rounded bg-blue-100 px-1 dark:bg-blue-900">{authInfo.demo_username}</code>
                  {" "}密码：<code className="rounded bg-blue-100 px-1 dark:bg-blue-900">{authInfo.demo_password}</code>
                </p>
                <p className="mt-1 text-xs opacity-70">{t("login.demo_hint")}</p>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("login.password")}</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.password_placeholder")}
                autoFocus
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("login.signing_in") : t("login.sign_in")}
            </Button>
          </form>
        </CardContent>
      </Card>
      {authInfo?.demo_mode && (
        <p className="absolute bottom-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()}{" "}
          <a href="https://github.com/Ysoseri1224" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Ysoseri1224</a>
          {" · "}
          <a href="https://github.com/Ysoseri1224/sub-recorder" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">sub-recorder</a>
        </p>
      )}
    </div>
  );
}
