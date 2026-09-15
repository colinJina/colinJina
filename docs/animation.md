# Colin 贡献像素动画

每次真实贡献对应一个方块。最近一年公开可见的 GitHub 贡献日历决定粒子总量，每个粒子的绿色强度来自对应日期。GIF 每轮 10 秒：下落成字 4 秒、停留 4 秒、散落 2 秒。配色适配 GitHub 深浅主题。

## 本地生成

需要 Node.js 22.18+（推荐 24）、npm 和 PATH 中的 FFmpeg/ffprobe。也可用 `FFMPEG_PATH` 指定 FFmpeg 可执行文件，默认使用同目录 ffprobe；特殊安装可另外设置 `FFPROBE_PATH`。

```sh
npm ci
npm run check
npm test
npm run fetch
npm run generate
```

获取数据需设置 `GITHUB_TOKEN`；只通过环境变量传入，不写入文件。已有 GitHub CLI 登录时，PowerShell 可运行：

```powershell
$env:GITHUB_TOKEN = gh auth token
try { npm run fetch } finally { Remove-Item Env:GITHUB_TOKEN }
npm run generate
```

复用已生成的快照（不联网）：

```sh
npm run generate -- generated/contributions.json
```

生成器接受第二个参数作为仓库内部输出目录，用于预览；默认为 `generated/`。不会替换历史 `2020/` 实现。

## 数据与字形

- 官方 GraphQL `user.contributionsCollection.contributionCalendar` 是唯一在线数据源。由 GitHub 决定默认过去一年及日历周边界，可能略多于 365 格；元数据保留完整时间范围，图中显示实际日历日期。
- 严格验证日期连续性、每日贡献、强度和总数。公开可见的匿名私有贡献是否计入，以当前令牌下接口的返回为准，不请求访问私有仓库。
- 同一份每日数据生成同一布局和运动；颜色打乱位置但不改变来源及数量。
- 字形由手绘掩码定义，各粗像素格分配真实粒子，并按数量细分；不足以覆盖轮廓时显示淡灰辅助轮廓。灰轮廓不计为贡献。零贡献显示明确空状态。
- 超高数量时自动提高输出分辨率，保持每个粒子至少约 2 个绘制像素；网页缩小时细节可能融合。不会删除或截断贡献。

## 自动更新

`.github/workflows/contribution-pixels.yml` 每天 UTC 00:17（北京时间 08:17）运行，支持 Actions 的 **Run workflow**，修改生成器也会触发。GitHub 可能延迟或暂停不活跃仓库的定时任务。

工作流使用内置 `GITHUB_TOKEN`。分支和 PR 运行生成检查并上传可下载产物；仅默认分支提交生成结果。深浅主题与元数据在同一提交中发布，生成失败不会覆盖旧图片。受保护默认分支若禁止机器人推送，最后发布步骤会失败，需按仓库规则提交产物 PR。

`generated/manifest.json` 记录贡献数、粒子数、帧率、分辨率和大小。`generated/contributions.json` 只含日历汇总，不包含仓库名或访问令牌。静态 PNG 可用于核对成形帧。

## 排错与验收

- API 错误/计数不一致：查看失败步骤，保留原图，不用随机数据替代。
- FFmpeg 未找到：安装并加入 PATH，或设置 `FFMPEG_PATH`。
- GIF 超过 5 MiB：生成器拒绝发布，优先优化调色板/帧编码，不减少粒子数。
- 像素字形不依赖字体；小字说明统一使用随仓库附带的 IBM Plex Mono，授权见 `assets/fonts/OFL.txt`。
- 首次上线比对 Profile 的同一区间贡献数，检查深浅背景、375px 宽显示、成字停留和循环衔接。
- README 图片经过 GitHub 缓存，成功提交后可能稍晚更新；定时生成不等于访问时实时查询。

运行方式：Canvas 逐帧 PNG → FFmpeg 差异调色板 → GIF。`.cache/` 仅存临时快照与渲染帧，导出出错后可检查，确认不需要时可自行清理。
