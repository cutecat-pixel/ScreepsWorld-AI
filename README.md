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
   - MineralHarvester：矿物采集者
   - MineralHauler：矿物运输工
   - TerminalHauler：终端运输者，专注于终端物流

2. **管理器模块**：
   - Creep管理器：管理creep的生成、分配和行为
   - 塔防管理器：控制防御塔的行为
   - LINK管理器：控制LINK的能量传输
   - 内存管理器：维护和清理游戏内存数据
   - 游戏阶段管理器：判断当前游戏状态并调整策略
   - 终端管理器：管理终端交易和物流

3. **工具模块**：提供各种实用的辅助功能

## 特点

- **自适应性**：系统会根据游戏阶段自动调整策略和creep配置
- **模块化设计**：便于维护和扩展
- **资源优化**：高效利用能量和其他资源
- **智能防御**：自动应对敌人入侵
- **内存管理**：定期清理无效数据，避免内存泄漏
- **市场交易**：自动管理和执行矿物交易

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
- **后期阶段**：高度优化

## 自定义

如果需要调整系统行为，可以修改以下文件：

- `manager.gameStage.js`：调整不同游戏阶段的判断标准和creep配置
- `main.js`：修改主循环逻辑
- 各角色文件：调整特定角色的行为逻辑

## 市场交易功能

本系统提供了完善的市场交易功能，可以方便地进行资源交易和管理：

### 自动K矿物交易

K矿物自动交易系统会监控市场上的K矿物订单，并自动完成交易：

1. **启用K矿物自动交易**：
   ```javascript
   enableKMineralTrading('房间名', 最小保留数量); // 最小保留数量默认为1000
   ```

2. **禁用K矿物自动交易**：
   ```javascript
   disableKMineralTrading('房间名');
   ```

当自动交易启用后，系统会自动查找价格最优的K矿物订单，并在保证最小库存的情况下进行交易。

### 资源转移

在终端和Storage之间转移资源：

1. **从终端转移资源到Storage**：
   ```javascript
   transferFromTerminal('房间名', RESOURCE_ENERGY); // 转移所有能量
   transferFromTerminal('房间名', RESOURCE_ENERGY, 5000); // 转移5000单位能量
   transferFromTerminal('房间名', RESOURCE_KEANIUM); // 转移所有K矿物
   ```

### 市场价格查询

在创建订单前，可以查询市场上的最佳价格：

```javascript
findBestPrice(RESOURCE_ENERGY, ORDER_SELL); // 查询能量的最低卖出价格
findBestPrice(RESOURCE_ENERGY, ORDER_BUY);  // 查询能量的最高收购价格
findBestPrice(RESOURCE_KEANIUM, ORDER_SELL); // 查询K矿物的最低卖出价格
```

### 创建购买订单

可以创建购买资源的长期订单：

```javascript
createBuyOrder('房间名', RESOURCE_ENERGY, 10000, 0.2); // 创建购买10000能量的订单，价格0.2/单位
createBuyOrder('房间名', RESOURCE_KEANIUM, 5000, 0.5); // 创建购买5000 K矿物的订单，价格0.5/单位
```

### 自动准备交易所需能量

为了方便交易，系统提供了自动准备交易所需能量的功能：

```javascript
prepareTerminalEnergy('房间名', 10000); // 确保终端中有至少10000能量
```

您也可以使用集成的函数一步完成订单创建和能量准备：

```javascript
prepareBuyOrder('房间名', RESOURCE_ENERGY, 10000, 0.2, 5000); 
// 创建购买10000能量的订单，价格0.2/单位，并确保终端中有5000能量作为交易费用
```

### 长期订单能量维护

对于长期订单，系统提供了自动维护终端能量水平的功能，确保总是有足够的能量支付交易手续费：

```javascript
// 设置终端能量维护，保持至少5000能量，每100tick检查一次
setTerminalEnergyMaintenance('房间名', 5000, 100);

// 禁用终端能量维护
disableTerminalEnergyMaintenance('房间名');
```

当您创建长期订单时，系统会自动启用能量维护功能，确保订单总是能够正常交易。您也可以手动调整维护的能量水平和检查频率，以适应不同的交易需求。

### 直接购买资源

如果需要立即获得资源，可以直接从市场购买：

```javascript
buyResourceFromMarket('房间名', RESOURCE_ENERGY, 5000, 0.3); // 购买5000能量，最高接受0.3/单位
buyResourceFromMarket('房间名', RESOURCE_KEANIUM, 2000, 0.6); // 购买2000 K矿物，最高接受0.6/单位
```

系统会自动找到价格最低的订单进行购买，并将资源送到房间终端。如果终端能量不足以支付交易费用，系统会自动从Storage转移足够的能量到Terminal。您可以稍后使用`transferFromTerminal`将资源转移到Storage。

所有与市场交易相关的操作都会自动处理好终端和Storage之间的资源流动，您无需额外操作。

## 注意事项

- 系统会自动适应单房间和多房间情况
- 在受到攻击时会自动增加防御者数量
- 每100个tick会输出资源统计信息 
- 交易功能需要房间中有终端(Terminal)设施
- 自动交易需要房间同时有终端和存储(Storage)设施

## 远程部署环境准备和部署教程

### 远程部署环境准备

要想远程提交代码使用此系统，你需要先准备以下环境：

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
   你可以在[这里](https://screeps.com/a/#!/account/auth-tokens)获取自己的token

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

