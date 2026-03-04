# PMS Responsive Prototype (Next.js)

并行重构版，用于在不影响现有 `pms-responsive-demo` 进度的前提下，逐步迁移到 React/Next.js。

## 目录
- `app/page.tsx`: 主原型页面（节点面板、首页、节点详情、hover提示、动作弹窗）
- `lib/prototypeData.ts`: 节点与动作数据模型
- `app/globals.css`: 全局样式

## 本地运行
```bash
cd project-materials/prototype/pms-responsive-next
npm install
npm run dev
```

默认地址：`http://localhost:3000`

## 当前迁移范围
- 节点侧栏筛选/搜索
- 首页待办与患者队列
- 节点说明弹窗
- hover说明提示
- 按钮“跳转/接口调用弹窗”双模式
- 患者端、护士端核心节点模板（其余节点通用模板承接）

## 迁移策略
1. 新旧原型并行维护，不改旧目录。
2. 先迁移交互能力，再分批细化页面高保真。
3. 每批完成后同步更新工作清单与日志。

