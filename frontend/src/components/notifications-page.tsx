"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Webhook, Check, AlertCircle, Send, Loader2, MessageSquare, MessageCircle } from "lucide-react";
import {
  listNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  testNotification,
  type NotificationChannel,
} from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

export function NotificationsPage() {
  const { t } = useTranslations();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);

  // 新增/编辑表单状态 - 4种独立类型
  const [formType, setFormType] = useState<"smtp" | "onebot" | "telegram" | "webhook" | "discord" | "wechat">("smtp");
  const [formName, setFormName] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);

  // SMTP 配置
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("Sub Recorder");
  const [smtpToEmail, setSmtpToEmail] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);

  // Webhook 配置
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState("POST");
  const [webhookType, setWebhookType] = useState("onebot");
  const [webhookHeaders, setWebhookHeaders] = useState("");
  const [webhookBodyTemplate, setWebhookBodyTemplate] = useState('{"message": "{message"}');

  // OneBot 专用配置
  const [onebotAccessToken, setOnebotAccessToken] = useState("");
  const [onebotMessageType, setOnebotMessageType] = useState<"private" | "group">("private");
  const [onebotTargetId, setOnebotTargetId] = useState("");

  // Telegram 专用配置
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramSilent, setTelegramSilent] = useState(false);
  const [fetchingChatId, setFetchingChatId] = useState(false);

  // Discord 专用配置
  const [discordUrl, setDiscordUrl] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");

  // WeChat Bot 专用配置
  const [wechatUrl, setWechatUrl] = useState("");
  const [wechatTo, setWechatTo] = useState("");
  const [wechatToken, setWechatToken] = useState("");

  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const data = await listNotificationChannels();
      setChannels(data);
    } catch (e) {
      toast.error(t("notif.save_fail"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormEnabled(true);
    setFormType("smtp");
    
    setSmtpHost("");
    setSmtpPort(587);
    setSmtpUsername("");
    setSmtpPassword("");
    setSmtpFromEmail("");
    setSmtpFromName("Sub Recorder");
    setSmtpToEmail("");
    setSmtpUseTls(true);
    
    setWebhookUrl("");
    setWebhookMethod("POST");
    setWebhookType("onebot");
    setWebhookHeaders("");
    setWebhookBodyTemplate('{"message": "{message"}');
    setOnebotAccessToken("");
    setOnebotMessageType("private");
    setOnebotTargetId("");
    
    setTelegramBotToken("");
    setTelegramChatId("");
    setTelegramSilent(false);

    setDiscordUrl("");
    setDiscordUsername("");

    setWechatUrl("");
    setWechatTo("");
    setWechatToken("");

    setEditingChannel(null);
    setShowAddForm(false);
  };

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setFormName(channel.name);
    setFormEnabled(channel.enabled);
    setFormType(channel.channel_type);
    const config = channel.config;

    if (channel.channel_type === "smtp") {
      setSmtpHost(config.host || "");
      setSmtpPort(config.port || 587);
      setSmtpUsername(config.username || "");
      setSmtpPassword("");
      setSmtpFromEmail(config.from_email || "");
      setSmtpFromName(config.from_name || "Sub Recorder");
      setSmtpToEmail(config.to_email || "");
      setSmtpUseTls(config.use_tls !== false);
    } else if (channel.channel_type === "onebot") {
      setWebhookUrl(config.url || "");
      setOnebotAccessToken(config.access_token || "");
      setOnebotMessageType(config.message_type || "private");
      setOnebotTargetId(config.target_id || "");
    } else if (channel.channel_type === "telegram") {
      setTelegramBotToken(config.bot_token || "");
      setTelegramChatId(config.chat_id || "");
      setTelegramSilent(config.silent || false);
    } else if (channel.channel_type === "webhook") {
      setWebhookUrl(config.url || "");
      setWebhookMethod(config.method || "POST");
      setWebhookHeaders(config.headers ? JSON.stringify(config.headers, null, 2) : "");
      setWebhookBodyTemplate(config.body_template || '{"message": "{message"}');
    } else if (channel.channel_type === "discord") {
      setDiscordUrl(config.url || "");
      setDiscordUsername(config.username || "");
    } else if (channel.channel_type === "wechat") {
      setWechatUrl(config.url || "");
      setWechatTo(config.to || "");
      setWechatToken(config.token || "");
    }

    setShowAddForm(true);
  };

  // 自动获取 Telegram Chat ID
  const fetchTelegramChatId = async () => {
    if (!telegramBotToken.trim()) {
      toast.error(t("notif.telegram_token"));
      return;
    }
    setFetchingChatId(true);
    try {
      const resp = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getUpdates?limit=10`);
      const data = await resp.json();
      if (!data.ok) {
        toast.error(data.description || t("notif.test_fail"));
        return;
      }
      if (!data.result || data.result.length === 0) {
        toast.error(t("notif.test_fail"));
        return;
      }
      const lastMsg = data.result[data.result.length - 1];
      const chatId = lastMsg.message?.chat?.id || lastMsg.channel_post?.chat?.id;
      if (chatId) {
        setTelegramChatId(String(chatId));
        toast.success(`${t("notif.telegram_chat")}: ${chatId}`);
      } else {
        toast.error(t("notif.test_fail"));
      }
    } catch (e: any) {
      toast.error(e.message || t("notif.test_fail"));
    } finally {
      setFetchingChatId(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error(t("notif.name"));
      return;
    }

    let config: any = {};

    if (formType === "smtp") {
      if (!smtpHost || !smtpFromEmail || !smtpToEmail) {
        toast.error(t("notif.smtp_host"));
        return;
      }
      config = {
        host: smtpHost,
        port: smtpPort,
        username: smtpUsername,
        password: smtpPassword,
        from_email: smtpFromEmail,
        from_name: smtpFromName,
        to_email: smtpToEmail,
        use_tls: smtpUseTls,
      };
    } else if (formType === "onebot") {
      if (!webhookUrl || !onebotTargetId) {
        toast.error(t("notif.webhook_url"));
        return;
      }
      config = {
        url: webhookUrl,
        access_token: onebotAccessToken || undefined,
        message_type: onebotMessageType,
        target_id: onebotTargetId,
      };
    } else if (formType === "telegram") {
      if (!telegramBotToken || !telegramChatId) {
        toast.error(t("notif.telegram_token"));
        return;
      }
      config = {
        bot_token: telegramBotToken,
        chat_id: telegramChatId,
        silent: telegramSilent,
      };
    } else if (formType === "webhook") {
      if (!webhookUrl) {
        toast.error(t("notif.webhook_url"));
        return;
      }
      
      let headers = null;
      if (webhookHeaders.trim()) {
        try {
          headers = JSON.parse(webhookHeaders);
        } catch (e) {
          toast.error(t("notif.webhook_body"));
          return;
        }
      }

      config = {
        url: webhookUrl,
        method: webhookMethod,
        headers,
        body_template: webhookBodyTemplate,
      };
    } else if (formType === "discord") {
      if (!discordUrl) {
        toast.error(t("notif.discord_url"));
        return;
      }
      config = { url: discordUrl, username: discordUsername };
    } else if (formType === "wechat") {
      if (!wechatUrl || !wechatTo) {
        toast.error(t("notif.wechat_url"));
        return;
      }
      config = { url: wechatUrl, to: wechatTo, token: wechatToken };
    }

    try {
      if (editingChannel) {
        await updateNotificationChannel(editingChannel.id, {
          name: formName,
          enabled: formEnabled,
          config,
        });
        toast.success(t("notif.save_ok"));
      } else {
        await createNotificationChannel({
          name: formName,
          channel_type: formType,
          enabled: formEnabled,
          config,
        });
        toast.success(t("notif.save_ok"));
      }
      resetForm();
      loadChannels();
    } catch (e: any) {
      toast.error(e.message || t("notif.save_fail"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("notif.delete_confirm"))) return;

    try {
      await deleteNotificationChannel(id);
      toast.success(t("notif.deleted"));
      loadChannels();
    } catch (e: any) {
      toast.error(e.message || t("notif.delete_failed"));
    }
  };

  const handleTest = async () => {
    let config: any = {};

    if (formType === "smtp") {
      if (!smtpHost || !smtpFromEmail || !smtpToEmail) {
        toast.error(t("notif.smtp_host"));
        return;
      }
      config = {
        host: smtpHost,
        port: smtpPort,
        username: smtpUsername,
        password: smtpPassword,
        from_email: smtpFromEmail,
        from_name: smtpFromName,
        to_email: smtpToEmail,
        use_tls: smtpUseTls,
      };
    } else if (formType === "onebot") {
      if (!webhookUrl || !onebotTargetId) {
        toast.error(t("notif.webhook_url"));
        return;
      }
      config = {
        url: webhookUrl,
        access_token: onebotAccessToken || undefined,
        message_type: onebotMessageType,
        target_id: onebotTargetId,
      };
    } else if (formType === "telegram") {
      if (!telegramBotToken || !telegramChatId) {
        toast.error(t("notif.telegram_token"));
        return;
      }
      config = {
        bot_token: telegramBotToken,
        chat_id: telegramChatId,
        silent: telegramSilent,
      };
    } else if (formType === "webhook") {
      if (!webhookUrl) {
        toast.error(t("notif.webhook_url"));
        return;
      }

      let headers = null;
      if (webhookHeaders.trim()) {
        try {
          headers = JSON.parse(webhookHeaders);
        } catch (e) {
          toast.error(t("notif.webhook_body"));
          return;
        }
      }

      config = {
        url: webhookUrl,
        method: webhookMethod,
        headers,
        body_template: webhookBodyTemplate,
      };
    } else if (formType === "discord") {
      if (!discordUrl) {
        toast.error(t("notif.discord_url"));
        return;
      }
      config = { url: discordUrl, username: discordUsername };
    } else if (formType === "wechat") {
      if (!wechatUrl || !wechatTo) {
        toast.error(t("notif.wechat_url"));
        return;
      }
      config = { url: wechatUrl, to: wechatTo, token: wechatToken };
    }

    setTesting(true);
    try {
      const result = await testNotification({
        channel_type: formType,
        config,
      });
      toast.success(result.message || t("notif.test_ok"));
    } catch (e: any) {
      toast.error(e.message || t("notif.test_fail"));
    } finally {
      setTesting(false);
    }
  };

  const handleToggleEnabled = async (channel: NotificationChannel) => {
    try {
      await updateNotificationChannel(channel.id, {
        enabled: !channel.enabled,
      });
      loadChannels();
    } catch (e: any) {
      toast.error(e.message || t("notif.save_fail"));
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-8 px-6">{t("common.loading")}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-['MiSans']">{t("notif.title")}</h1>
        <Button onClick={() => setShowAddForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("notif.add")}
        </Button>
      </div>

      {/* 渠道列表 */}
      <div className="space-y-4 mb-6">
        {channels.length === 0 && !showAddForm && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("notif.no_channels")}</p>
            <p className="text-sm mt-2">{t("notif.add")}</p>
          </div>
        )}

        {channels.map((channel) => (
          <div key={channel.id} className="p-4 rounded-xl border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {channel.channel_type === "smtp" && <Mail className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "onebot" && <Webhook className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "telegram" && <Send className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "webhook" && <Webhook className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "discord" && <MessageSquare className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "wechat" && <MessageCircle className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {channel.channel_type === "smtp" && t("notif.smtp_host")}
                    {channel.channel_type === "onebot" && "OneBot"}
                    {channel.channel_type === "telegram" && "Telegram"}
                    {channel.channel_type === "webhook" && t("notif.webhook_url")}
                    {channel.channel_type === "discord" && "Discord"}
                    {channel.channel_type === "wechat" && t("notif.wechat_url")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={channel.enabled}
                  onCheckedChange={() => handleToggleEnabled(channel)}
                />
                <Button variant="ghost" size="sm" onClick={() => handleEdit(channel)}>
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(channel.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <div className="p-6 rounded-xl border bg-card space-y-4">
          <h2 className="text-lg font-medium">
            {editingChannel ? t("common.edit") + " " + t("notif.title") : t("notif.add")}
          </h2>

          <div className="space-y-4">
            {/* 通知类型选择 - 放在最前面且更醒目 */}
            {!editingChannel && (
              <div className="space-y-2">
                <Label className="text-base font-medium">{t("notif.type")}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType("smtp")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "smtp"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4" />
                      <span className="font-medium text-sm">{t("notif.smtp_host")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">SMTP</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("onebot")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "onebot"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Webhook className="h-4 w-4" />
                      <span className="font-medium text-sm">OneBot</span>
                    </div>
                    <p className="text-xs text-muted-foreground">OneBot</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("telegram")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "telegram"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Send className="h-4 w-4" />
                      <span className="font-medium text-sm">Telegram</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Telegram</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("webhook")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "webhook"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Webhook className="h-4 w-4" />
                      <span className="font-medium text-sm">Webhook</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("notif.webhook_method")}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("discord")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "discord"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-medium text-sm">Discord</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Discord</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("wechat")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "wechat"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-4 w-4" />
                      <span className="font-medium text-sm">{t("notif.wechat_url").split(" ")[0]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">WeChatBot</p>
                  </button>
                </div>
              </div>
            )}

            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>{t("notif.name")}</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("notif.name")}
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>{t("notif.enabled")}</Label>
                <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              </div>
            </div>

            {/* OneBot 配置 */}
            {formType === "onebot" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>{t("notif.webhook_url")}</Label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="http://127.0.0.1:5700"
                  />
                  <p className="text-xs text-muted-foreground">{t("notif.onebot_url_hint")}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t("common.optional")}: Access Token</Label>
                  <Input
                    type="password"
                    value={onebotAccessToken}
                    onChange={(e) => setOnebotAccessToken(e.target.value)}
                    placeholder={t("notif.onebot_token_placeholder")}
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    ⚠️ {t("notif.onebot_token_warning")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("notif.type")}</Label>
                    <Select 
                      value={onebotMessageType} 
                      onValueChange={(v: "private" | "group") => setOnebotMessageType(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">{t("notif.onebot_private")}</SelectItem>
                        <SelectItem value="group">{t("notif.onebot_group")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{onebotMessageType === "private" ? t("notif.onebot_private_id") : t("notif.onebot_group_id")}</Label>
                    <Input
                      value={onebotTargetId}
                      onChange={(e) => setOnebotTargetId(e.target.value)}
                      placeholder={onebotMessageType === "private" ? t("notif.onebot_id_placeholder_private") : t("notif.onebot_id_placeholder_group")}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Telegram 配置 */}
            {formType === "telegram" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>{t("notif.telegram_token")}</Label>
                  <Input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("notif.telegram_token_hint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Chat ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder={t("notif.telegram_chat_placeholder")}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchTelegramChatId}
                      disabled={fetchingChatId || !telegramBotToken.trim()}
                      className="shrink-0"
                    >
                      {fetchingChatId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("notif.telegram_fetch")
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("notif.telegram_chat_hint")}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t("notif.telegram_silent")}</Label>
                    <p className="text-xs text-muted-foreground">{t("notif.telegram_silent_desc")}</p>
                  </div>
                  <Switch checked={telegramSilent} onCheckedChange={setTelegramSilent} />
                </div>
              </div>
            )}

            {/* 自定义 Webhook 配置 */}
            {formType === "webhook" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notif.webhook_method")}</Label>
                    <Select value={webhookMethod} onValueChange={setWebhookMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="GET">GET</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("notif.webhook_body")} ({t("common.optional")})</Label>
                  <textarea
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border bg-background"
                    value={webhookHeaders}
                    onChange={(e) => setWebhookHeaders(e.target.value)}
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("notif.webhook_body_label")}</Label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border bg-background font-mono"
                    value={webhookBodyTemplate}
                    onChange={(e) => setWebhookBodyTemplate(e.target.value)}
                    placeholder='{"text": "{title}: {message}"}'
                  />
                </div>
              </div>
            )}

            {/* Discord 配置 */}
            {formType === "discord" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>{t("notif.discord_url")}</Label>
                  <Input
                    value={discordUrl}
                    onChange={(e) => setDiscordUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                  <p className="text-xs text-muted-foreground">{t("notif.discord_url_hint")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("notif.discord_username")}</Label>
                  <Input
                    value={discordUsername}
                    onChange={(e) => setDiscordUsername(e.target.value)}
                    placeholder={t("notif.discord_username_placeholder")}
                  />
                </div>
              </div>
            )}

            {/* WeChat Bot 配置 */}
            {formType === "wechat" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>{t("notif.wechat_url")}</Label>
                  <Input
                    value={wechatUrl}
                    onChange={(e) => setWechatUrl(e.target.value)}
                    placeholder="http://127.0.0.1:5700/notify"
                  />
                  <p className="text-xs text-muted-foreground">{t("notif.wechat_url_hint")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("notif.wechat_to")}</Label>
                  <Input
                    value={wechatTo}
                    onChange={(e) => setWechatTo(e.target.value)}
                    placeholder="wxid_xxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">{t("notif.wechat_to_hint")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("notif.wechat_token")}</Label>
                  <Input
                    type="password"
                    value={wechatToken}
                    onChange={(e) => setWechatToken(e.target.value)}
                    placeholder={t("notif.wechat_token_placeholder")}
                  />
                </div>
              </div>
            )}

            {/* SMTP 配置 */}
            {formType === "smtp" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("notif.smtp_host")}</Label>
                    <Input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notif.smtp_port")}</Label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="587"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("notif.smtp_user")}</Label>
                    <Input
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notif.smtp_pass")}</Label>
                    <Input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={editingChannel ? t("notif.onebot_token_placeholder") : ""}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("notif.smtp_from")}</Label>
                    <Input
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      placeholder="noreply@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notif.smtp_user")}</Label>
                    <Input
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                      placeholder="Sub Recorder"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("notif.smtp_to")}</Label>
                  <Input
                    value={smtpToEmail}
                    onChange={(e) => setSmtpToEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>{t("notif.smtp_ssl")}</Label>
                  <Switch checked={smtpUseTls} onCheckedChange={setSmtpUseTls} />
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" />
                {t("common.save")}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? t("notif.testing") : t("notif.test")}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
