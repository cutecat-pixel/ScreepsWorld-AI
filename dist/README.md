# 远程采矿系统使用指南

本指南介绍如何使用远程采矿系统，该系统允许在预定的房间中采集能源并将其运回主房间。

## 功能概述

远程采矿系统包括两个主要组件：
1. **远程矿工(RemoteMiner)** - 负责在目标房间采集能源
2. **远程运输者(RemoteHauler)** - 负责将能源从目标房间运回主房间

这个系统与入侵管理器集成，只能在使用`reserve`模式预定的房间中使用。

## 使用方法

### 1. 创建预定任务

首先，您需要创建一个对目标房间的预定入侵任务：

```javascript
// 使用reserve模式入侵目标房间
global.invade('W1N1', 'W1N2', {
    claim: true,
    dismantle: false,
    claimMode: 'reserve'
});
```

### 2. 启用远程采矿

一旦目标房间被成功预定（控制器显示预定状态），您可以启用远程采矿功能：

```javascript
// 启用远程采矿，参数：目标房间名称，矿工数量，运输者数量
global.enableRemoteMining('W1N2', 1, 2);
```

参数说明：
- 第一个参数：目标房间名称
- 第二个参数：派遣的远程矿工数量（默认为1）
- 第三个参数：派遣的远程运输者数量（默认为1）

### 3. 禁用远程采矿

如果您想停止远程采矿活动：

```javascript
// 禁用对特定房间的远程采矿
global.disableRemoteMining('W1N2');
```

### 4. 取消预定任务

如果您想完全结束对目标房间的控制：

```javascript
// 取消入侵任务
global.cancelInvasion('W1N2');
```

## 系统特点

1. **自动化管理** - 系统会自动检查并补充死亡的远程矿工和运输者
2. **能源存储优化** - 远程运输者会优先将能源送往需要能源的建筑（spawn、extension等）
3. **智能待命** - 当主房间不需要能源时，远程运输者会进入待命状态，避免无效运输
4. **容器优化** - 远程矿工会自动在能源源点附近建造容器，提高效率

## 注意事项

1. 确保目标房间是安全的，或者有足够的防御措施
2. 目标房间必须能够被成功预定
3. 主房间应有足够的能源来生成远程矿工和运输者
4. 运输距离会影响效率，请选择适当的目标房间

## 示例

```javascript
// 创建对W5N8房间的预定任务
global.invade('W5N7', 'W5N8', {
    claim: true,
    dismantle: false,
    claimMode: 'reserve'
});

// 启用远程采矿，使用2个矿工和3个运输者
global.enableRemoteMining('W5N8', 2, 3);

// 查看入侵状态
global.getInvasionStatus();
```

祝您使用愉快！ 