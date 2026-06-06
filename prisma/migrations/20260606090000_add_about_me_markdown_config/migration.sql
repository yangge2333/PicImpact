INSERT INTO "configs" ("id", "config_key", "config_value", "detail", "created_at", "updated_at")
VALUES (
  'about_me_markdown',
  'about_me_markdown',
  '# 关于我

这里是船长的摄影小屋。

我会在这里放一些拍摄介绍、合作说明和近期计划。

## 联系方式

QQ: 774202796

微信: 13634085297',
  '关于我页面 Markdown 内容',
  NOW(),
  NOW()
)
ON CONFLICT ("config_key") DO NOTHING;
