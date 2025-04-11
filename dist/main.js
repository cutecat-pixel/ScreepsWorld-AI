// 导入各个模块
const _managers = require('_managers');
const _roles = require('_roles');
const linkManager = require('manager.link');

// 添加全局入侵辅助函数
global.invade = function(sourceRoomName, targetRoomName, options = {}) {
    return _managers.invasion.startInvasion(sourceRoomName, targetRoomName, options);
};

global.cancelInvasion = function(targetRoomName) {
    return _managers.invasion.cancelInvasion(targetRoomName);
};

global.getInvasionStatus = function() {
    return _managers.invasion.getInvasionStatus();
};

// 添加远程采矿辅助函数
global.enableRemoteMining = function(targetRoomName, minerCount = 1, haulerCount = 1) {
    return _managers.invasion.enableRemoteMining(targetRoomName, minerCount, haulerCount);
};

global.disableRemoteMining = function(targetRoomName) {
    return _managers.invasion.disableRemoteMining(targetRoomName);
};

// 添加房间签名辅助函数
global.signRoom = function(spawnRoomName, targetRoomName, signText) {
    return _roles.signer.createSignerTask(spawnRoomName, targetRoomName, signText);
};

// 添加移动优化辅助函数
global.printMovementStats = function() {
    return _managers.movement.printStats();
};

global.clearRoomPaths = function(roomName) {
    return _managers.movement.clearPathsInRoom(roomName);
};

global.avoidRoom = function(roomName) {
    return _managers.movement.addRoomToAvoid(roomName);
};

global.allowRoom = function(roomName) {
    return _managers.movement.removeRoomToAvoid(roomName);
};

global.clearRoomCostMatrix = function(roomName) {
    return _managers.movement.clearRoomCostMatrix(roomName);
};

// 添加手动生成防御者辅助函数
global.spawnDefender = function(spawnRoomName, targetRoomName, priority = 1) {
    // 确保有生成队列
    if(!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    
    if(!Memory.spawnQueue[spawnRoomName]) {
        Memory.spawnQueue[spawnRoomName] = [];
    }
    
    // 添加到生成队列，可以指定优先级
    Memory.spawnQueue[spawnRoomName].push({
        role: 'defender',
        priority: priority,
        memory: {
            role: 'defender',
            homeRoom: spawnRoomName,
            targetRoom: targetRoomName,
            patrolAssigned: true // 标记这是手动指派的防御者
        }
    });
    
    console.log(`已添加防御任务: 从 ${spawnRoomName} 派出防御者至 ${targetRoomName}`);
    return `防御任务已添加到队列，defender将在下次生成周期被创建`;
};

// 添加远程建造者辅助函数
global.spawnRemoteBuilder = function(spawnRoomName, targetRoomName, count = 2, priority = 2) {
    return _roles.remoteBuilder.createRemoteBuilderTask(spawnRoomName, targetRoomName, count, priority);
};

// 修改远程建造者数量
global.updateRemoteBuilders = function(targetRoomName, count) {
    if(!Memory.remoteBuilders) {
        Memory.remoteBuilders = {};
    }
    
    if(!Memory.remoteBuilders[targetRoomName]) {
        console.log(`错误：${targetRoomName} 没有远程建造任务配置`);
        return `没有找到 ${targetRoomName} 的远程建造任务`;
    }
    
    Memory.remoteBuilders[targetRoomName].count = count;
    console.log(`已更新 ${targetRoomName} 的远程建造者数量为 ${count}`);
    
    // 找到可用的出生房间
    const possibleSpawnRooms = _.filter(Game.rooms, room => 
        room.controller && room.controller.my && room.find(FIND_MY_SPAWNS).length > 0
    );
    
    if(possibleSpawnRooms.length > 0) {
        _roles.remoteBuilder.createRemoteBuilderTask(possibleSpawnRooms[0].name, targetRoomName, count, 2);
    }
    
    return `远程建造者数量已更新为 ${count}`;
};

// 取消远程建造任务
global.cancelRemoteBuilders = function(targetRoomName) {
    if(!Memory.remoteBuilders || !Memory.remoteBuilders[targetRoomName]) {
        return `没有找到 ${targetRoomName} 的远程建造任务`;
    }
    
    delete Memory.remoteBuilders[targetRoomName];
    console.log(`已取消 ${targetRoomName} 的远程建造任务`);
    
    return `远程建造任务已取消`;
};

// 添加K矿物自动交易功能
global.enableKMineralTrading = function(roomName, minAmount = 1000) {
    return _managers.terminal.enableKMineralTrading(roomName, minAmount);
};

global.disableKMineralTrading = function(roomName) {
    return _managers.terminal.disableKMineralTrading(roomName);
};

// 添加从终端转移资源到Storage的函数
global.transferFromTerminal = function(roomName, resourceType = RESOURCE_ENERGY, amount = 0) {
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    if(!room.terminal) {
        return `错误：房间 ${roomName} 没有终端设施`;
    }
    
    if(!room.storage) {
        return `错误：房间 ${roomName} 没有存储设施`;
    }
    
    // 如果没有指定数量或数量为0，则转移所有该资源
    const actualAmount = amount || room.terminal.store[resourceType] || 0;
    if(actualAmount <= 0) {
        return `错误：终端中没有${resourceType}资源可转移`;
    }
    
    // 创建转移任务
    if(!room.memory.terminalTasks) {
        room.memory.terminalTasks = [];
    }
    
    room.memory.terminalTasks.push({
        id: Game.time.toString() + resourceType,
        type: 'transfer',
        resource: resourceType,
        amount: actualAmount,
        from: 'terminal',
        to: 'storage',
        priority: 1 // 高优先级
    });
    
    return `已创建转移任务：从终端向Storage转移 ${actualAmount} 单位的 ${resourceType}`;
};

// 添加创建购买订单的全局函数
global.createBuyOrder = function(roomName, resourceType = RESOURCE_ENERGY, amount = 10000, price = 0.1) {
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    if(!room.terminal) {
        return `错误：房间 ${roomName} 没有终端设施`;
    }
    
    // 检查是否有足够的Credits
    const totalCost = amount * price;
    if(Game.market.credits < totalCost) {
        return `错误：Credits不足，需要 ${totalCost} Credits，但您只有 ${Game.market.credits} Credits`;
    }
    
    // 创建购买订单
    const result = Game.market.createOrder({
        type: ORDER_BUY,
        resourceType: resourceType,
        price: price,
        totalAmount: amount,
        roomName: roomName
    });
    
    if(result === OK) {
        return `成功创建${resourceType}购买订单，数量: ${amount}，价格: ${price}`;
    } else {
        return `创建订单失败，错误代码: ${result}`;
    }
};

// 添加自动将能量转移到终端的函数，用于支付交易手续费
global.prepareTerminalEnergy = function(roomName, energyAmount = 10000) {
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    if(!room.terminal) {
        return `错误：房间 ${roomName} 没有终端设施`;
    }
    
    if(!room.storage) {
        return `错误：房间 ${roomName} 没有存储设施`;
    }
    
    // 检查终端当前的能量
    const terminalEnergy = room.terminal.store[RESOURCE_ENERGY] || 0;
    
    // 计算需要转移的能量
    const neededEnergy = Math.max(0, energyAmount - terminalEnergy);
    
    // 如果终端已经有足够能量，则不需要转移
    if(neededEnergy <= 0) {
        return `终端已有足够能量: ${terminalEnergy}`;
    }
    
    // 检查Storage中的能量是否足够
    const storageEnergy = room.storage.store[RESOURCE_ENERGY] || 0;
    if(storageEnergy < neededEnergy) {
        return `错误：Storage能量不足，需要: ${neededEnergy}，可用: ${storageEnergy}`;
    }
    
    // 创建从Storage到Terminal的能量转移任务
    if(!room.memory.terminalTasks) {
        room.memory.terminalTasks = [];
    }
    
    // 检查是否已有相同类型的任务
    const existingTask = _.find(room.memory.terminalTasks, task => 
        task.resource === RESOURCE_ENERGY && 
        task.from === 'storage' && 
        task.to === 'terminal'
    );
    
    if(existingTask) {
        // 更新现有任务的数量
        existingTask.amount += neededEnergy;
        return `已更新能量转移任务：从Storage向Terminal转移 ${existingTask.amount} 能量`;
    } else {
        // 创建新的转移任务
        room.memory.terminalTasks.push({
            id: Game.time.toString() + RESOURCE_ENERGY,
            type: 'transfer',
            resource: RESOURCE_ENERGY,
            amount: neededEnergy,
            from: 'storage',
            to: 'terminal',
            priority: 1 // 高优先级
        });
        
        return `已创建能量转移任务：从Storage向Terminal转移 ${neededEnergy} 能量`;
    }
};

// 添加创建购买订单并准备交易能量的综合函数
global.prepareBuyOrder = function(roomName, resourceType = RESOURCE_ENERGY, amount = 10000, price = 0.1, additionalEnergy = 5000) {
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    // 准备终端能量，除了基础能量外，再加上一定数量以备交易使用
    const prepareResult = prepareTerminalEnergy(roomName, additionalEnergy);
    console.log(prepareResult);
    
    // 创建购买订单
    const orderResult = createBuyOrder(roomName, resourceType, amount, price);
    
    // 设置终端能量维护，确保长期订单有足够能量支付手续费
    const maintenanceResult = setTerminalEnergyMaintenance(roomName, additionalEnergy);
    console.log(maintenanceResult);
    
    return `${prepareResult}\n${orderResult}\n${maintenanceResult}`;
};

// 添加终端能量维护配置函数
global.setTerminalEnergyMaintenance = function(roomName, minEnergy = 5000, checkInterval = 100) {
    return _managers.terminal.setTerminalEnergyMaintenance(roomName, minEnergy, checkInterval);
};

// 添加禁用终端能量维护的函数
global.disableTerminalEnergyMaintenance = function(roomName) {
    return _managers.terminal.disableTerminalEnergyMaintenance(roomName);
};

// 添加查找资源最优价格的函数
global.findBestPrice = function(resourceType = RESOURCE_ENERGY, orderType = ORDER_SELL) {
    // 获取市场上所有指定类型的订单
    const orders = Game.market.getAllOrders({
        resourceType: resourceType,
        type: orderType
    });
    
    if(!orders || orders.length === 0) {
        return `市场上没有${orderType === ORDER_SELL ? '卖出' : '买入'} ${resourceType} 的订单`;
    }
    
    // 按照价格排序（卖出订单按价格从低到高，买入订单按价格从高到低）
    const sortedOrders = _.sortBy(orders, order => orderType === ORDER_SELL ? order.price : -order.price);
    
    // 显示前5个最佳价格
    let message = `${resourceType} ${orderType === ORDER_SELL ? '卖出' : '买入'}订单最佳价格:\n`;
    
    for(let i = 0; i < Math.min(5, sortedOrders.length); i++) {
        const order = sortedOrders[i];
        message += `${i+1}. ID: ${order.id}, 价格: ${order.price}, 数量: ${order.amount}, 房间: ${order.roomName || '未知'}\n`;
    }
    
    return message;
};

// 添加直接从市场购买资源的函数
global.buyResourceFromMarket = function(roomName, resourceType = RESOURCE_ENERGY, amount = 1000, maxPrice = 1.0, autoPrepareFee = true) {
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    if(!room.terminal) {
        return `错误：房间 ${roomName} 没有终端设施`;
    }
    
    // 获取所有卖出该资源的订单
    const orders = Game.market.getAllOrders({
        resourceType: resourceType,
        type: ORDER_SELL
    });
    
    if(!orders || orders.length === 0) {
        return `市场上没有卖出 ${resourceType} 的订单`;
    }
    
    // 按价格从低到高排序
    const sortedOrders = _.sortBy(orders, order => order.price);
    
    // 查找价格在预算范围内的订单
    const affordableOrders = sortedOrders.filter(order => order.price <= maxPrice);
    
    if(affordableOrders.length === 0) {
        return `没有找到价格在 ${maxPrice} 以下的 ${resourceType} 订单`;
    }
    
    // 选择价格最低的订单
    const bestOrder = affordableOrders[0];
    
    // 计算实际购买数量（不超过订单数量和请求数量）
    const actualAmount = Math.min(bestOrder.amount, amount);
    
    // 计算交易成本
    const tradeCost = Game.market.calcTransactionCost(actualAmount, roomName, bestOrder.roomName);
    
    // 检查终端是否有足够的能量支付交易成本
    const terminalEnergy = room.terminal.store[RESOURCE_ENERGY] || 0;
    if(terminalEnergy < tradeCost) {
        // 如果启用了自动准备交易费用
        if(autoPrepareFee && room.storage) {
            const prepareResult = prepareTerminalEnergy(roomName, tradeCost);
            console.log(prepareResult);
            
            // 自动准备交易费用需要时间，告知用户稍后尝试
            return `终端能量不足，需要 ${tradeCost} 能量用于交易，已创建能量转移任务。请等待TerminalHauler完成能量运输后再次尝试交易。`;
        } else {
            return `终端能量不足，需要 ${tradeCost} 能量用于交易，但只有 ${terminalEnergy} 能量`;
        }
    }
    
    // 执行交易
    const result = Game.market.deal(bestOrder.id, actualAmount, roomName);
    
    if(result === OK) {
        return `成功从订单 ${bestOrder.id} 购买 ${actualAmount} 单位 ${resourceType}，价格: ${bestOrder.price}，交易成本: ${tradeCost} 能量`;
    } else {
        return `交易失败，错误代码: ${result}`;
    }
};

/**
 * Screeps主逻辑入口
 * 每tick会自动调用这个函数
 */
module.exports.loop = function() {
    // 初始化移动优化系统（如果是第一次运行或重置）
    if(!global.moveOptimized) {
        _managers.movement.initialize();
        global.moveOptimized = true;
    }
    
    // 清理内存
    _managers.memory.cleanupMemory();
    
    // 处理入侵任务
    _managers.invasion.processInvasions();
    
    // 维护远程建造者数量
    _roles.remoteBuilder.maintainRemoteBuilders();
    
    // 遍历所有房间
    for(const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        
        // 确保只针对我们控制的房间运行代码
        if(room.controller && room.controller.my) {
            // 获取当前房间的游戏阶段
            const gameStage = _managers.gameStage.getCurrentStage(room);
            
            // 处理房间中的防御塔
            _managers.tower.manageTowers(room);
            
            // 管理LINK能量传输
            _managers.link.manageLinks(room);
            
            // 管理终端交易
            _managers.terminal.run(room);
            
            // 管理该房间的creep生成
            _managers.creep.manageCreeps(room, gameStage);
        }
    }
    
    // 运行所有creep的逻辑
    _managers.creep.runCreeps();
    
    // 每100个tick报告一次统计信息
    if(Game.time % 100 === 0) {
        _managers.memory.reportStats();
        // 当CPU bucket达到10000时生成pixel
        if(Game.cpu.bucket >= 10000) {
            Game.cpu.generatePixel();
            console.log(`已使用10000 CPU bucket兑换1个pixel，当前bucket: ${Game.cpu.bucket}`);
        }
    }

    stateScanner();
};
/**
 * 全局统计信息扫描器
 * 负责搜集关于 cpu、memory、GCL、GPL 的相关信息
 */
const stateScanner = function () {
    // 每 20 tick 运行一次
    if (Game.time % 20) return 
  
    if (!Memory.stats) Memory.stats = {}
    
    // 保留基础统计数据
    Memory.stats.gcl = (Game.gcl.progress / Game.gcl.progressTotal) * 100
    Memory.stats.gclLevel = Game.gcl.level
    Memory.stats.gpl = (Game.gpl.progress / Game.gpl.progressTotal) * 100
    Memory.stats.gplLevel = Game.gpl.level
    // CPU 的当前使用量
    Memory.stats.cpu = Game.cpu.getUsed()
    // bucket 当前剩余量
    Memory.stats.bucket = Game.cpu.bucket
}