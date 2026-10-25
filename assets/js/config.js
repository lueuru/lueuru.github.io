/* ============================================================
 * 新笔文学社 · 基础版本 —— 站点配置
 * cloudEndpoint / publishableKey 来自 WorkBuddy 云服务 publicConfig，
 * 是唯一允许出现在前端代码里的两个值（服务端会校验 Origin 精确匹配）。
 * 把 cloudEnabled 设为 false 即完全退回本地模式。
 * ============================================================ */
window.XB_CONFIG = {
  cloudEnabled: true,
  cloudEndpoint: "https://xinbi-literature.app.workbuddy.host",
  publishableKey: "wbpk_kq2rA8Pw0b13ombavGOPPC_tEgImQMi7OP5rUXvWjJbrfBO63H3Ax8E",
  cloudTimeoutMs: 8000,

  /* 旧站 Supabase 项目已从公网消失（DNS 无解析），保留配置仅作记录，
     站点不再依赖它；如需恢复请在 Supabase 控制台恢复项目并把 enableRemote 置 true。 */
  legacySupabase: {
    enableRemote: false,
    supabaseUrl: "https://aybnmewinjckmftvctvx.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Ym5tZXdpbmpja21mdHZjdHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDE3NTIsImV4cCI6MjA5ODMxNzc1Mn0.BtEGJgZZbMCVvkRkmgeSw8mrTcf6xIiLZrL9Xm7mdnE",
    timeoutMs: 7000
  }
};
