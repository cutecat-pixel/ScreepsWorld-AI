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

// 添加清除终端任务的全局函数
global.clearTerminalTasks = function(roomName) {
    return _managers.terminal.clearAllTerminalTasks(roomName);
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

// 添加手动生成远程运输者的函数，用于从指定房间的STORAGE搬运能量
global.spawnStorageHauler = function(sourceRoomName, targetRoomName, count = 1, priority = 2) {
    // 警告用户使用新的API
    console.log(`警告: spawnStorageHauler函数已弃用，请使用setStorageHaulers函数代替。正在使用新API执行请求。`);
    
    // 调用新的API
    return setStorageHaulers(sourceRoomName, targetRoomName, count, priority);
};

// 添加启用或更新Storage Hauler的函数
global.enableStorageHauler = function(sourceRoomName, targetRoomName, count = 1, priority = 2) {
    // 警告用户使用新的API
    console.log(`警告: enableStorageHauler函数已弃用，请使用setStorageHaulers函数代替。正在使用新API执行请求。`);
    
    // 调用新的API
    return setStorageHaulers(sourceRoomName, targetRoomName, count, priority);
};

// 设置Storage Haulers的新函数
global.setStorageHaulers = function(sourceRoomName, targetRoomName, count = 1, priority = 2) {
    // 检查源房间是否存在
    const sourceRoom = Game.rooms[sourceRoomName];
    if(!sourceRoom) {
        return `错误：无法访问源房间 ${sourceRoomName}`;
    }
    
    // 检查源房间是否有生成点
    const spawns = sourceRoom.find(FIND_MY_SPAWNS);
    if(spawns.length === 0) {
        return `错误：源房间 ${sourceRoomName} 没有可用的生成点`;
    }
    
    // 初始化房间的storageHaulers结构
    if(!sourceRoom.memory.storageHaulers) {
        sourceRoom.memory.storageHaulers = {};
    }
    
    // 更新配置
    sourceRoom.memory.storageHaulers[targetRoomName] = {
        count: count,
        priority: priority
    };
    
    // 确保creepConfigs中的设置也更新
    if(!Memory.creepConfigs) Memory.creepConfigs = {};
    if(!Memory.creepConfigs.remoteHauler) Memory.creepConfigs.remoteHauler = {};
    if(!Memory.creepConfigs.remoteHauler[sourceRoomName]) Memory.creepConfigs.remoteHauler[sourceRoomName] = {};
    
    // 设置creepConfigs
    Memory.creepConfigs.remoteHauler[sourceRoomName] = {
        targetRoom: targetRoomName,
        storageHauler: true,
        priority: priority
    };
    
    console.log(`Storage Hauler配置已更新：从 ${sourceRoomName} 到 ${targetRoomName}，数量：${count}，优先级：${priority}`);
    
    return `已设置 ${sourceRoomName} 房间派遣 ${count} 个存储运输者至 ${targetRoomName}`;
};

// 添加禁用Storage Hauler的函数
global.disableStorageHaulers = function(sourceRoomName, targetRoomName) {
    // 检查源房间是否存在
    const sourceRoom = Game.rooms[sourceRoomName];
    if(!sourceRoom) {
        return `错误：无法访问源房间 ${sourceRoomName}`;
    }
    
    // 检查配置是否存在
    if(!sourceRoom.memory.storageHaulers || !sourceRoom.memory.storageHaulers[targetRoomName]) {
        return `错误：未找到从 ${sourceRoomName} 到 ${targetRoomName} 的Storage Hauler配置`;
    }
    
    // 删除配置
    delete sourceRoom.memory.storageHaulers[targetRoomName];
    
    // 如果没有其他配置，删除整个结构
    if(Object.keys(sourceRoom.memory.storageHaulers).length === 0) {
        delete sourceRoom.memory.storageHaulers;
    }
    
    console.log(`已禁用从 ${sourceRoomName} 到 ${targetRoomName} 的Storage Hauler`);
    
    return `Storage Hauler配置已禁用`;
};

// 获取所有Storage Hauler配置的函数
global.getStorageHaulersStatus = function() {
    let status = `Storage Hauler配置状态：\n`;
    let hasConfigs = false;
    
    // 遍历所有可见房间
    for(const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        
        // 跳过不是我们控制的房间
        if(!room.controller || !room.controller.my) continue;
        
        // 检查房间是否有Storage Hauler配置
        if(room.memory.storageHaulers) {
            for(const targetRoomName in room.memory.storageHaulers) {
                const config = room.memory.storageHaulers[targetRoomName];
                hasConfigs = true;
                
                // 计算当前活跃的haulers数量
                const currentCount = _.filter(Game.creeps, creep => 
                    creep.memory.role === 'remoteHauler' && 
                    creep.memory.storageHauler === true &&
                    creep.memory.homeRoom === roomName &&
                    creep.memory.targetRoom === targetRoomName
                ).length;
                
                status += `源房间：${roomName}，目标房间：${targetRoomName}，配置数量：${config.count}，当前数量：${currentCount}，优先级：${config.priority}\n`;
            }
        }
    }
    
    if(!hasConfigs) {
        return `当前没有Storage Hauler配置`;
    }
    
    return status;
};

// 添加清除生成队列的函数
global.clearSpawnQueue = function(roomName, role) {
    // 如果不存在生成队列，直接返回
    if(!Memory.spawnQueue) {
        return `没有找到任何生成队列`;
    }
    
    // 如果提供了特定房间
    if(roomName) {
        // 检查该房间是否有生成队列
        if(!Memory.spawnQueue[roomName] || Memory.spawnQueue[roomName].length === 0) {
            return `房间 ${roomName} 没有待处理的生成队列`;
        }
        
        // 如果同时提供了角色，只清除该角色的队列项目
        if(role) {
            const originalLength = Memory.spawnQueue[roomName].length;
            Memory.spawnQueue[roomName] = Memory.spawnQueue[roomName].filter(item => 
                item.role !== role
            );
            
            const removedCount = originalLength - Memory.spawnQueue[roomName].length;
            
            // 如果清除后队列为空，删除整个队列对象
            if(Memory.spawnQueue[roomName].length === 0) {
                delete Memory.spawnQueue[roomName];
            }
            
            return `已从房间 ${roomName} 的生成队列中移除 ${removedCount} 个 ${role} 角色项目`;
        }
        // 如果没有提供角色，清除整个房间的队列
        else {
            const count = Memory.spawnQueue[roomName].length;
            delete Memory.spawnQueue[roomName];
            return `已清除房间 ${roomName} 的全部生成队列，共 ${count} 个项目`;
        }
    }
    // 如果没有提供特定房间，但提供了角色，清除所有房间中该角色的队列项目
    else if(role) {
        let totalRemoved = 0;
        
        for(const roomName in Memory.spawnQueue) {
            const originalLength = Memory.spawnQueue[roomName].length;
            
            Memory.spawnQueue[roomName] = Memory.spawnQueue[roomName].filter(item => 
                item.role !== role
            );
            
            const removedCount = originalLength - Memory.spawnQueue[roomName].length;
            totalRemoved += removedCount;
            
            // 如果清除后队列为空，删除该房间的队列对象
            if(Memory.spawnQueue[roomName].length === 0) {
                delete Memory.spawnQueue[roomName];
            }
        }
        
        return `已从所有房间的生成队列中移除 ${totalRemoved} 个 ${role} 角色项目`;
    }
    // 如果没有提供房间和角色，清除所有生成队列
    else {
        let totalCount = 0;
        for(const roomName in Memory.spawnQueue) {
            totalCount += Memory.spawnQueue[roomName].length;
        }
        
        Memory.spawnQueue = {};
        
        return `已清除所有房间的生成队列，共 ${totalCount} 个项目`;
    }
};

// 添加查看当前生成队列的函数
global.getSpawnQueue = function(roomName) {
    // 如果不存在生成队列，直接返回
    if(!Memory.spawnQueue) {
        return `没有找到任何生成队列`;
    }
    
    // 如果提供了特定房间
    if(roomName) {
        // 检查该房间是否有生成队列
        if(!Memory.spawnQueue[roomName] || Memory.spawnQueue[roomName].length === 0) {
            return `房间 ${roomName} 没有待处理的生成队列`;
        }
        
        // 生成详细信息
        let queueInfo = `房间 ${roomName} 的生成队列 (${Memory.spawnQueue[roomName].length} 个):\n`;
        
        // 按优先级排序
        const sortedQueue = [...Memory.spawnQueue[roomName]].sort((a, b) => a.priority - b.priority);
        
        for(let i = 0; i < sortedQueue.length; i++) {
            const item = sortedQueue[i];
            queueInfo += `${i+1}. 角色: ${item.role}, 优先级: ${item.priority}`;
            
            // 添加目标房间信息（如果有）
            if(item.memory && item.memory.targetRoom) {
                queueInfo += `, 目标房间: ${item.memory.targetRoom}`;
                
                // 添加Storage Hauler标记（如果有）
                if(item.memory.storageHauler) {
                    queueInfo += ` [存储运输]`;
                }
            }
            
            queueInfo += '\n';
        }
        
        return queueInfo;
    }
    // 如果没有提供房间，显示所有房间的队列概况
    else {
        let totalCount = 0;
        let queueInfo = `所有房间的生成队列概况:\n`;
        
        for(const roomName in Memory.spawnQueue) {
            const queueLength = Memory.spawnQueue[roomName].length;
            totalCount += queueLength;
            
            if(queueLength > 0) {
                const roleCount = {};
                
                // 统计各角色数量
                for(const item of Memory.spawnQueue[roomName]) {
                    roleCount[item.role] = (roleCount[item.role] || 0) + 1;
                }
                
                // 生成角色统计信息
                let roleInfo = '';
                for(const role in roleCount) {
                    roleInfo += `${role}: ${roleCount[role]}, `;
                }
                roleInfo = roleInfo.slice(0, -2); // 移除最后的逗号和空格
                
                queueInfo += `- 房间 ${roomName}: ${queueLength} 个 (${roleInfo})\n`;
            }
        }
        
        if(totalCount === 0) {
            return `没有找到任何待处理的生成队列`;
        }
        
        queueInfo += `总计: ${totalCount} 个待生成Creep`;
        return queueInfo;
    }
};

// 添加手动生成Hauler的函数
global.spawnHauler = function(roomName, count = 1, priority = 2) {
    // 检查房间是否存在
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    // 检查房间是否有生成点
    const spawns = room.find(FIND_MY_SPAWNS);
    if(spawns.length === 0) {
        return `错误：房间 ${roomName} 没有可用的生成点`;
    }
    
    // 确保有生成队列
    if(!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    
    if(!Memory.spawnQueue[roomName]) {
        Memory.spawnQueue[roomName] = [];
    }
    
    // 生成指定数量的Hauler
    for(let i = 0; i < count; i++) {
        // 添加到生成队列
        Memory.spawnQueue[roomName].push({
            role: 'hauler',
            priority: priority,
            memory: {
                role: 'hauler',
                homeRoom: roomName,
                working: false
            }
        });
    }
    
    console.log(`已添加 ${count} 个Hauler到 ${roomName} 的生成队列`);
    return `已将 ${count} 个Hauler添加到房间 ${roomName} 的生成队列，优先级: ${priority}`;
};

// 添加手动生成Miner的函数
global.spawnMiner = function(roomName, count = 1, priority = 1) {
    // 检查房间是否存在
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    // 检查房间是否有生成点
    const spawns = room.find(FIND_MY_SPAWNS);
    if(spawns.length === 0) {
        return `错误：房间 ${roomName} 没有可用的生成点`;
    }
    
    // 确保有生成队列
    if(!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    
    if(!Memory.spawnQueue[roomName]) {
        Memory.spawnQueue[roomName] = [];
    }
    
    // 生成指定数量的Miner
    for(let i = 0; i < count; i++) {
        // 添加到生成队列
        Memory.spawnQueue[roomName].push({
            role: 'miner',
            priority: priority,
            memory: {
                role: 'miner',
                homeRoom: roomName,
                working: false,
                dontPullMe: true  // 矿工不被对穿
            }
        });
    }
    
    console.log(`已添加 ${count} 个Miner到 ${roomName} 的生成队列`);
    return `已将 ${count} 个Miner添加到房间 ${roomName} 的生成队列，优先级: ${priority}`;
};

// 添加手动生成Upgrader的函数
global.spawnUpgrader = function(roomName, count = 1, priority = 3) {
    // 检查房间是否存在
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    // 检查房间是否有生成点
    const spawns = room.find(FIND_MY_SPAWNS);
    if(spawns.length === 0) {
        return `错误：房间 ${roomName} 没有可用的生成点`;
    }
    
    // 确保有生成队列
    if(!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    
    if(!Memory.spawnQueue[roomName]) {
        Memory.spawnQueue[roomName] = [];
    }
    
    // 生成指定数量的Upgrader
    for(let i = 0; i < count; i++) {
        // 添加到生成队列
        Memory.spawnQueue[roomName].push({
            role: 'upgrader',
            priority: priority,
            memory: {
                role: 'upgrader',
                homeRoom: roomName,
                working: false,
                dontPullMe: true  // 升级者不被对穿
            }
        });
    }
    
    console.log(`已添加 ${count} 个Upgrader到 ${roomName} 的生成队列`);
    return `已将 ${count} 个Upgrader添加到房间 ${roomName} 的生成队列，优先级: ${priority}`;
};

// 添加手动生成Builder的函数
global.spawnBuilder = function(roomName, count = 1, priority = 4) {
    // 检查房间是否存在
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    // 检查房间是否有生成点
    const spawns = room.find(FIND_MY_SPAWNS);
    if(spawns.length === 0) {
        return `错误：房间 ${roomName} 没有可用的生成点`;
    }
    
    // 确保有生成队列
    if(!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    
    if(!Memory.spawnQueue[roomName]) {
        Memory.spawnQueue[roomName] = [];
    }
    
    // 生成指定数量的Builder
    for(let i = 0; i < count; i++) {
        // 添加到生成队列
        Memory.spawnQueue[roomName].push({
            role: 'builder',
            priority: priority,
            memory: {
                role: 'builder',
                homeRoom: roomName,
                working: false,
                dontPullMe: true  // 建造者不被对穿
            }
        });
    }
    
    console.log(`已添加 ${count} 个Builder到 ${roomName} 的生成队列`);
    return `已将 ${count} 个Builder添加到房间 ${roomName} 的生成队列，优先级: ${priority}`;
};

// 添加手动生成Repairer的函数
global.spawnRepairer = function(roomName, count = 1, priority = 5) {
    // 检查房间是否存在
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    // 检查房间是否有生成点
    const spawns = room.find(FIND_MY_SPAWNS);
    if(spawns.length === 0) {
        return `错误：房间 ${roomName} 没有可用的生成点`;
    }
    
    // 确保有生成队列
    if(!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    
    if(!Memory.spawnQueue[roomName]) {
        Memory.spawnQueue[roomName] = [];
    }
    
    // 生成指定数量的Repairer
    for(let i = 0; i < count; i++) {
        // 添加到生成队列
        Memory.spawnQueue[roomName].push({
            role: 'repairer',
            priority: priority,
            memory: {
                role: 'repairer',
                homeRoom: roomName,
                working: false
            }
        });
    }
    
    console.log(`已添加 ${count} 个Repairer到 ${roomName} 的生成队列`);
    return `已将 ${count} 个Repairer添加到房间 ${roomName} 的生成队列，优先级: ${priority}`;
};

// 添加手动生成WallRepairer的函数
global.spawnWallRepairer = function(roomName, count = 1, priority = 6) {
    // 检查房间是否存在
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    // 检查房间是否有生成点
    const spawns = room.find(FIND_MY_SPAWNS);
    if(spawns.length === 0) {
        return `错误：房间 ${roomName} 没有可用的生成点`;
    }
    
    // 确保有生成队列
    if(!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    
    if(!Memory.spawnQueue[roomName]) {
        Memory.spawnQueue[roomName] = [];
    }
    
    // 生成指定数量的WallRepairer
    for(let i = 0; i < count; i++) {
        // 添加到生成队列
        Memory.spawnQueue[roomName].push({
            role: 'wallRepairer',
            priority: priority,
            memory: {
                role: 'wallRepairer',
                homeRoom: roomName,
                working: false
            }
        });
    }
    
    console.log(`已添加 ${count} 个WallRepairer到 ${roomName} 的生成队列`);
    return `已将 ${count} 个WallRepairer添加到房间 ${roomName} 的生成队列，优先级: ${priority}`;
};

// 添加显示所有生成命令帮助的函数
global.spawnHelp = function() {
    return `可用的生成命令：

基础角色：
  spawnHauler(房间名, 数量=1, 优先级=2)         - 生成运输者
  spawnMiner(房间名, 数量=1, 优先级=1)          - 生成矿工
  spawnUpgrader(房间名, 数量=1, 优先级=3)       - 生成升级者
  spawnBuilder(房间名, 数量=1, 优先级=4)        - 生成建造者
  spawnRepairer(房间名, 数量=1, 优先级=5)       - 生成修理者
  spawnWallRepairer(房间名, 数量=1, 优先级=6)   - 生成墙体修理者

特殊角色：
  spawnDefender(出生房间, 目标房间, 优先级=1)   - 生成防御者
  spawnRemoteBuilder(出生房间, 目标房间, 数量=2, 优先级=2) - 生成远程建造者
  setStorageHaulers(出生房间, 目标房间, 数量=1, 优先级=2)  - 设置存储运输者
  
管理命令：
  getSpawnQueue(房间名)           - 查看生成队列
  clearSpawnQueue(房间名, 角色名) - 清除生成队列

示例:
  spawnHauler('W1N1', 2)        - 在W1N1生成2个运输者
  spawnMiner('W1N1')            - 在W1N1生成1个矿工
  spawnDefender('W1N1', 'W2N2') - 从W1N1生成防御者去W2N2防御
`;
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