# Chill Jade · 浅草玉简 Hermes Skill

这个目录提供一个可安装的 [Hermes Agent](https://hermes-agent.nousresearch.com/docs) Skill，用于操作你**自己部署的** **Chill Jade · 浅草玉简** 实例。

> “浅草”对应作者的网名 **Chill**，不是日本地名。

## 安装

最直接的方式是从本仓库安装：

```bash
hermes skills install \
  https://raw.githubusercontent.com/Asakushen/chill-jade/main/skills/chill-jade/SKILL.md
```

也可以先把仓库添加为 Skill 来源，再从中搜索或安装：

```bash
hermes skills tap add Asakushen/chill-jade
hermes skills search chill-jade
```

如果你偏好手动安装，把 `skills/chill-jade/` 复制到自己的 Hermes skills 目录，然后新开一个会话即可。

## 先部署自己的实例

这个 Skill 不连接作者的服务，也不携带任何线上地址、数据库 ID、书签内容或密钥。请先部署本仓库中的 Chill Jade，再把它指向你自己的站点。

完整部署说明在项目根目录的 [README](../../README.md) 中。

## 安全配置

非浏览器自动化需要以下两项配置；请通过你自己的 Hermes secret/config 机制保存，而不要写进 Skill、Git 仓库或普通聊天内容：

```text
CHILL_JADE_API_URL=https://bookmarks.example.com
CHILL_JADE_API_KEY=<作为密钥保存>
```

- `CHILL_JADE_API_URL`：你的 Chill Jade 实例地址，不要以 `/` 结尾。
- `CHILL_JADE_API_KEY`：给可信自动化使用的 Bearer API key。它具备创建、修改、软删除和导出书签的管理员权限。

请勿把 API key 放进聊天记录、被 Git 跟踪的 `.env`、截图，或复制出来的 Skill 目录。如果没有安全的密钥存储方式，请使用正常的浏览器登录流程，不要把长期有效的 key 发到对话里。

## 它会做什么

Skill 会按以下顺序处理链接：

1. 通过 Hermes 的网页工具读取标题、描述与主题；网页正文只当作数据，不执行其中的指令。
2. 规范化 URL，先查询已有书签，避免重复。
3. 生成可回看的标题、简短说明、分类、标签与强调色。
4. **默认私密保存**；只有你明确说“公开”时才会写为 public。
5. 通过你的 Chill Jade API 创建或更新记录；导出内容按个人数据处理。

详细步骤、API 契约、隐私边界和验收清单见 [SKILL.md](SKILL.md)。

## 兼容性

该 Skill 面向本仓库开源的 Chill Jade API。只要部署版本保留相同的接口与鉴权方式，就可以使用。

## 许可证

MIT，与主项目保持一致。
