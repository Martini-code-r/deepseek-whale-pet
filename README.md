# 溟月 · DeepSeek 鲸鱼娘桌宠

一个会陪你摸鱼、吃饭、打盹的 Windows **Q版**桌面宠物。角色是网络上很火的 DeepSeek 同人形象「鲸鱼娘 · 溟月」：大头大眼睛、圆滚滚的短手短脚，蓝色渐变长发、鲸鳍耳朵、大鲸尾、深蓝白女仆裙，主食白饭，傲娇但嘴甜。

> 非商业同人作品。角色原型「溟月」由 **上善无形** 创作，以 **CC BY-NC-SA 4.0** 开放二创；Q版修复由 **QYQCAMIAO** 完成。DeepSeek 名称与商标归其权利人所有，本项目与 DeepSeek 官方无隶属关系。详见 [LICENSE-ART.md](LICENSE-ART.md)。

![桌宠预览](shots/01-idle.png)

## 直接启动

本机这份完整目录已经带好 Electron 运行时，不需要安装环境。任选一种：

1. 双击桌面上的 **「溟月桌宠」** 快捷方式；
2. 或在项目目录双击 **`启动桌宠.vbs`**（无黑框，推荐）；
3. 或双击 `launch.cmd`（会短暂出现命令行窗口）。

> 如果你是从 GitHub **clone 或下载源码**，仓库里不包含体积很大的 `node_modules`。请先在本目录执行：
>
> ```powershell
> npm.cmd install
> ```
>
> 安装完 Electron 后，再双击 `启动桌宠.vbs`。如果 npm 下载 Electron 很慢，可以先设置镜像：
>
> ```powershell
> $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
> npm.cmd install
> ```

> 如果移动了整个文件夹，桌面快捷方式会失效，重新对 `启动桌宠.vbs` 发送快捷方式即可。

启动后溟月会以约 180px 宽的 Q版尺寸出现在屏幕右下角、任务栏上方。她会自己漂浮、说悄悄话，也会在你很久不理她时打盹。

## 互动

| 操作 | 反应 |
| --- | --- |
| 单击头顶 | 摸头，冒出爱心 |
| 单击身体 | 戳一戳，傲娇回应 |
| 按住拖动 | 把溟月搬到任意位置（会记住位置） |
| 鼠标滚轮 | 调整大小 80%–125% |
| 右键单击 | 打开菜单 |
| 悬停角色 | 右侧出现「摸摸 / 喂饭 / 说话 / 菜单」快捷按钮 |
| 双击托盘图标 | 显示 / 隐藏 |
| 右键托盘图标 | 显示、喂饭、回右下角、置顶、开机自启、退出 |

菜单里还可以：调整大小、始终置顶、开关音效、开机自动启动、回到右下角、隐藏到托盘、查看署名与许可。

小细节：

- 喂到第 5、10、15……碗时，她会说不同的台词。
- 连续戳太多次会被吐槽。
- 00:00–05:00、早上、中午、晚上有不同问候。
- 3 分钟不互动会睡着，鼠标移上去会醒。
- 台词全部是本地预设，不联网、不上传任何数据。

## 文件说明

```
deepseek-whale-pet/
├─ 启动桌宠.vbs          # 双击启动（无黑框）
├─ launch.cmd / launch.vbs
├─ main.js               # Electron 主进程：透明窗口、托盘、拖拽、位置记忆
├─ preload.js            # 安全 IPC 桥
├─ index.html            # 界面结构
├─ styles.css            # 气泡、菜单、动画、透明窗口样式
├─ renderer.js           # 摸头/喂饭/对话/睡眠/音效/点击穿透
├─ assets/
│  ├─ pet.png            # 透明 Q版立绘
│  ├─ icon.png           # 头像
│  ├─ pet.ico            # Windows 图标
│  └─ alpha-mask.js      # 点击穿透用的轮廓遮罩
├─ refs/                 # Q版素材源图与溯源说明
├─ scripts/              # 素材处理、启动器、冒烟截图
├─ shots/                # 验收截图
└─ .userdata/            # 运行时生成：位置、大小、设置
```

## 开发者

需要 Node.js 20+（本项目使用 Electron 44.7.0）：

```powershell
# 启动
npm.cmd start

# 重新生成 Q版透明立绘与轮廓遮罩
npm.cmd run art

# 自动截图验收，输出到 shots/
npm.cmd run smoke
```

如果 `node_modules` 丢失，在项目目录执行：

```powershell
npm.cmd install
```

在 DSH 等 Electron 宿主终端里启动时，宿主会注入 `ELECTRON_RUN_AS_NODE`，使 Electron 变成 Node 模式。`launch.cmd` 与 `scripts/start.js` 会自动清除它；由于本机 Windows 策略会拦截 Chromium 沙箱，启动器固定追加 `--no-sandbox`。桌宠只加载本地文件、不访问网络，因此不影响使用安全。

## 许可与署名

- **角色原型**：「溟月」© 上善无形，CC BY-NC-SA 4.0。
- **女仆装鲸鱼娘二创设计**：ZipZipPipe 及社区创作者。
- **Q版修复**：QYQCAMIAO；透明底素材来自 [fornarwhal/deepseek-whale-girl-icon](https://github.com/fornarwhal/deepseek-whale-girl-icon)。
- **形象参考报道**：钛媒体 / 字母AI，《DeepSeek里长出了个“鲸鱼娘”》，<https://www.tmtpost.com/8110298.html>。
- **本桌宠**：非商业二创，同样以 CC BY-NC-SA 4.0 共享；禁止商业使用，转载/改编请保留作者、来源与相同许可。

详细授权链、修改说明与免责声明见 [LICENSE-ART.md](LICENSE-ART.md)。
