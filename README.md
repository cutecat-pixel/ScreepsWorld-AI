# Screeps自动化系统

这是一个为Screeps游戏设计的模块化自动化系统，能够自动管理各种游戏资源和单位。

## 系统概述

该系统主要包含以下组件：

1. **角色模块**：定义了各种专门的creep角色
   - Harvester：能量采集者
   - Upgrader：升级控制器
   - Builder：建筑工
   - Repairer：修理工
   - Miner：专业矿工，专注采集能量
   - Hauler：运输工，负责物流
   - Defender：防御者，保护房间安全

2. **管理器模块**：
   - Creep管理器：管理creep的生成、分配和行为
   - 塔防管理器：控制防御塔的行为
   - 内存管理器：维护和清理游戏内存数据
   - 游戏阶段管理器：判断当前游戏状态并调整策略

3. **工具模块**：提供各种实用的辅助功能

## 特点

- **自适应性**：系统会根据游戏阶段自动调整策略和creep配置
- **模块化设计**：便于维护和扩展
- **资源优化**：高效利用能量和其他资源
- **智能防御**：自动应对敌人入侵
- **内存管理**：定期清理无效数据，避免内存泄漏

## 使用方法

1. 将所有文件上传到你的Screeps代码库
2. 系统会自动开始运行，无需额外配置
3. 在游戏初期，系统会自动生成基础的harvester和upgrader
4. 随着房间控制器等级提升，系统会引入更多专业角色

## 游戏阶段策略

系统根据不同的游戏阶段采用不同的策略：

- **早期阶段**：专注于能量收集和控制器升级
- **发展阶段**：开始建造基础设施
- **中期阶段**：引入矿工和运输工，优化能量流
- **高级阶段**：完善自动化和防御系统
- **后期阶段**：高度优化，准备扩张

## 自定义

如果需要调整系统行为，可以修改以下文件：

- `manager.gameStage.js`：调整不同游戏阶段的判断标准和creep配置
- `main.js`：修改主循环逻辑
- 各角色文件：调整特定角色的行为逻辑

## 注意事项

- 系统会自动适应单房间和多房间情况
- 在受到攻击时会自动增加防御者数量
- 每100个tick会输出资源统计信息 

## 环境准备和部署教程

### 环境准备

要使用此系统，你需要先准备以下环境：

1. **安装 Node.js 和 npm**：
   ```bash
   sudo apt install nodejs npm   # Ubuntu/Debian
   brew install node            # macOS
   ```

2. **安装必要的依赖**：
   ```bash
   npm install grunt grunt-screeps liftup --save-dev
   ```

3. **配置 Screeps 账号信息**：
   在项目根目录的 `Gruntfile.js` 文件中，更新以下配置：
   ```javascript
   options: {
       email: '你的Screeps邮箱',
       token: '你的Screeps令牌',
       branch: 'default',
       //server: 'season'  // 如果要部署到季节服务器，请取消此行注释
   }
   ```

### 手动部署

1. **使用 npm 命令部署**：
   ```bash
   npm run deploy
   ```

2. **或使用 npx 直接调用 grunt**：
   ```bash
   npx grunt screeps
   ```

### 使用自动化脚本部署

我们提供了两个脚本简化部署流程：

#### 基础部署脚本 (deploy.sh)

这个脚本会直接使用 `Gruntfile.js` 中的默认配置进行部署：

```bash
./deploy.sh
```

#### 高级部署脚本 (deploy-advanced.sh)

这个脚本允许指定不同的分支和服务器类型：

```bash
# 基本用法
./deploy-advanced.sh [分支名称] [服务器类型]

# 示例
./deploy-advanced.sh                 # 部署到默认分支和主服务器
./deploy-advanced.sh simulation      # 部署到simulation分支和主服务器
./deploy-advanced.sh dev season      # 部署到dev分支和季节服务器
```

### 初次使用指南

1. 克隆或下载此项目到本地
2. 安装必要的依赖 `npm install`
3. 更新 `Gruntfile.js` 中的账号信息
4. 给脚本添加执行权限 `chmod +x deploy.sh deploy-advanced.sh`
5. 运行部署脚本 `./deploy.sh` 或 `./deploy-advanced.sh`
6. 登录 Screeps 游戏查看你的 AI 运行情况

### 故障排除

如果部署过程中遇到问题：

1. **权限错误**：确保脚本有执行权限 `chmod +x deploy.sh`
2. **依赖问题**：运行 `npm install` 安装所有依赖
3. **认证失败**：检查 `Gruntfile.js` 中的账号信息是否正确
4. **Node.js 版本**：确保 Node.js 版本 >= 12.x 

