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

// 添加PowerCreep管理辅助函数
global.enableRoom = function(powerCreepName, roomName) {
    const powerCreep = Game.powerCreeps[powerCreepName];
    if(!powerCreep) {
        return `错误：无法找到PowerCreep ${powerCreepName}`;
    }
    
    const room = Game.rooms[roomName];
    if(!room || !room.controller || !room.controller.my) {
        return `错误：${roomName} 不是有效的控制房间`;
    }
    
    // 检查房间中是否有PowerSpawn
    const powerSpawn = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_POWER_SPAWN
    })[0];
    
    if(!powerSpawn) {
        return `警告：${roomName} 中没有PowerSpawn，PowerCreep将无法重生`;
    }
    
    // 设置PowerCreep的工作房间
    powerCreep.memory = powerCreep.memory || {};
    powerCreep.memory.homeRoom = roomName;
    console.log(`已将PowerCreep ${powerCreepName} 的工作房间设置为 ${roomName}`);
    
    // 如果PowerCreep已死亡，尝试重生
    if(!powerCreep.ticksToLive) {
        return `PowerCreep ${powerCreepName} 的工作房间已设置为 ${roomName}，将尝试在下一个tick中重生`;
    }
    
    return `PowerCreep ${powerCreepName} 的工作房间已设置为 ${roomName}`;
};

// 添加PowerCreep获取Power的辅助函数
global.getPower = function(powerCreepName) {
    const powerCreep = Game.powerCreeps[powerCreepName];
    if(!powerCreep) {
        return `错误：无法找到PowerCreep ${powerCreepName}`;
    }
    
    // 检查PowerCreep是否活跃
    if(!powerCreep.ticksToLive) {
        return `错误：PowerCreep ${powerCreepName} 未生成，请先使用enableRoom将其生成`;
    }
    
    // 检查PowerCreep是否已经有背包Power
    if(powerCreep.store[RESOURCE_POWER] > 0) {
        return `PowerCreep ${powerCreepName} 背包中已有 ${powerCreep.store[RESOURCE_POWER]} 单位的Power`;
    }
    
    // 检查房间中是否有储存Power的Storage
    const room = Game.rooms[powerCreep.memory.homeRoom];
    if(!room) {
        return `错误：无法访问PowerCreep的家乡房间`;
    }
    
    if(!room.storage || !room.storage.store[RESOURCE_POWER] || room.storage.store[RESOURCE_POWER] <= 0) {
        return `错误：${room.name} 的Storage中没有Power资源`;
    }
    
    // 设置PowerCreep需要收集Power的标志
    powerCreep.memory.needPower = true;
    // 重置其他可能的冲突标志
    powerCreep.memory.storePower = false;
    powerCreep.memory.deliverPower = false;
    
    return `已指派PowerCreep ${powerCreepName} 前往Storage获取Power`;
};

// 添加PowerCreep将Power存入Storage的辅助函数
global.storePower = function(powerCreepName) {
    const powerCreep = Game.powerCreeps[powerCreepName];
    if(!powerCreep) {
        return `错误：无法找到PowerCreep ${powerCreepName}`;
    }
    
    // 检查PowerCreep是否活跃
    if(!powerCreep.ticksToLive) {
        return `错误：PowerCreep ${powerCreepName} 未生成，请先使用enableRoom将其生成`;
    }
    
    // 检查PowerCreep是否有Power可以存储
    if(!powerCreep.store[RESOURCE_POWER] || powerCreep.store[RESOURCE_POWER] <= 0) {
        return `错误：PowerCreep ${powerCreepName} 背包中没有Power可以存储`;
    }
    
    // 检查房间中是否有Storage
    const room = Game.rooms[powerCreep.memory.homeRoom];
    if(!room) {
        return `错误：无法访问PowerCreep的家乡房间`;
    }
    
    if(!room.storage) {
        return `错误：${room.name} 中没有Storage`;
    }
    
    // 设置PowerCreep需要存储Power的标志
    powerCreep.memory.storePower = true;
    // 取消其他可能的冲突标志
    powerCreep.memory.needPower = false;
    powerCreep.memory.deliverPower = false;
    
    return `已指派PowerCreep ${powerCreepName} 将${powerCreep.store[RESOURCE_POWER]}单位Power存回Storage`;
};

// 添加PowerCreep将Power送到PowerSpawn的辅助函数
global.deliverPower = function(powerCreepName) {
    const powerCreep = Game.powerCreeps[powerCreepName];
    if(!powerCreep) {
        return `错误：无法找到PowerCreep ${powerCreepName}`;
    }
    
    // 检查PowerCreep是否活跃
    if(!powerCreep.ticksToLive) {
        return `错误：PowerCreep ${powerCreepName} 未生成，请先使用enableRoom将其生成`;
    }
    
    // 检查PowerCreep是否有Power可以运送
    if(!powerCreep.store[RESOURCE_POWER] || powerCreep.store[RESOURCE_POWER] <= 0) {
        return `错误：PowerCreep ${powerCreepName} 背包中没有Power可以运送`;
    }
    
    // 检查房间中是否有PowerSpawn
    const room = Game.rooms[powerCreep.memory.homeRoom];
    if(!room) {
        return `错误：无法访问PowerCreep的家乡房间`;
    }
    
    const powerSpawn = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_POWER_SPAWN
    })[0];
    
    if(!powerSpawn) {
        return `错误：${room.name} 中没有PowerSpawn`;
    }
    
    // 设置PowerCreep需要运送Power的标志
    powerCreep.memory.deliverPower = true;
    // 取消其他可能的冲突标志
    powerCreep.memory.storePower = false;
    powerCreep.memory.needPower = false;
    
    return `已指派PowerCreep ${powerCreepName} 将${powerCreep.store[RESOURCE_POWER]}单位Power送到PowerSpawn`;
};

// 添加获取PowerCreep信息的辅助函数
global.getPowerCreepInfo = function() {
    const info = {};
    
    for(const name in Game.powerCreeps) {
        const pc = Game.powerCreeps[name];
        // 获取PowerCreep当前的工作状态
        let status = pc.ticksToLive ? '活跃' : '未生成';
        if(pc.memory) {
            if(pc.memory.needPower) status = '正在获取Power';
            if(pc.memory.storePower) status = '正在存储Power';
            if(pc.memory.deliverPower) status = '正在运送Power';
            if(pc.memory.working) status = '正在使用能力';
        }
        
        info[name] = {
            className: pc.className,
            level: pc.level,
            homeRoom: pc.memory ? pc.memory.homeRoom : undefined,
            status: status,
            ticksToLive: pc.ticksToLive || 0,
            powers: {},
            resources: pc.store ? {
                ops: pc.store[RESOURCE_OPS] || 0,
                power: pc.store[RESOURCE_POWER] || 0
            } : {}
        };
        
        // 收集能力信息
        if(pc.powers) {
            for(const powerType in pc.powers) {
                info[name].powers[powerType] = {
                    level: pc.powers[powerType].level,
                    cooldown: pc.powers[powerType].cooldown
                };
            }
        }
    }
    
    return info;
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

/**
 * Spawns Dismantler creeps targeting an Invader Core in a specific room.
 * @param {string} spawnRoomName - The name of the room to spawn the creep from.
 * @param {string} targetRoomName - The name of the room containing the Invader Core.
 * @param {number} [count=1] - The number of dismantlers to spawn.
 * @param {number} [priority=5] - The spawn queue priority (lower numbers spawn first).
 */
global.spawnInvaderCoreDismantler = function(spawnRoomName, targetRoomName, count = 1, priority = 5) {
    if (!spawnRoomName || !targetRoomName) {
        return 'Error: Missing arguments. Usage: spawnInvaderCoreDismantler(\'spawnRoomName\', \'targetRoomName\', [count], [priority])';
    }

    // Ensure the spawn queue exists for the spawn room
    if (!Memory.spawnQueue) {
        Memory.spawnQueue = {};
    }
    if (!Memory.spawnQueue[spawnRoomName]) {
        Memory.spawnQueue[spawnRoomName] = [];
    }

    let addedCount = 0;
    for (let i = 0; i < count; i++) {
        const request = {
            role: 'dismantler', // Must match the role filename/key
            priority: priority,
            memory: {
                role: 'dismantler',
                homeRoom: spawnRoomName,   // Room to return to (or base operations from)
                targetRoom: targetRoomName // Room containing the Invader Core
                // Add any other necessary memory flags here
            }
        };
        Memory.spawnQueue[spawnRoomName].push(request);
        addedCount++;
    }

    const message = `Added ${addedCount} dismantler request(s) to spawn queue for room ${spawnRoomName}, targeting ${targetRoomName}.`;
    console.log(message);
    return message;
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
        return `成功创建购买订单：${amount}单位的${resourceType}，价格${price}`;
    } else {
        return `创建购买订单失败，错误码: ${result}`;
    }
};

// 添加创建出售订单的全局函数
global.createSellOrder = function(roomName, resourceType = RESOURCE_ENERGY, amount = 10000, price = 0.1) {
    const room = Game.rooms[roomName];
    if(!room) {
        return `错误：无法访问房间 ${roomName}`;
    }
    
    if(!room.terminal) {
        return `错误：房间 ${roomName} 没有终端设施`;
    }
    
    // 检查终端是否有足够的资源
    if((room.terminal.store[resourceType] || 0) < amount) {
        return `错误：终端中${resourceType}不足，需要 ${amount} 单位，但只有 ${room.terminal.store[resourceType] || 0} 单位`;
    }
    
    // 创建出售订单
    const result = Game.market.createOrder({
        type: ORDER_SELL,
        resourceType: resourceType,
        price: price,
        totalAmount: amount,
        roomName: roomName
    });
    
    if(result === OK) {
        return `成功创建出售订单：${amount}单位的${resourceType}，价格${price}`;
    } else {
        return `创建出售订单失败，错误码: ${result}`;
    }
};

// 添加取消所有订单的全局函数
global.cancelAllOrders = function() {
    let count = 0;
    for(const id in Game.market.orders) {
        Game.market.cancelOrder(id);
        count++;
    }
    return `已取消所有市场订单，共 ${count} 个`;
};

// 添加设置远程升级者数量的全局函数
global.setUpgraderCount = function(roomName, count) {
    if(!Memory.rooms[roomName]) {
        Memory.rooms[roomName] = {};
    }
    
    if(!Memory.rooms[roomName].targetCreepCounts) {
        Memory.rooms[roomName].targetCreepCounts = {};
    }
    
    Memory.rooms[roomName].targetCreepCounts.upgrader = count;
    return `房间 ${roomName} 的升级者数量已设置为 ${count}`;
};

// 添加Power相关的全局函数
global.enablePowerProcessing = function(roomName) {
    return _managers.powerSpawn.togglePowerProcessing(roomName, true);
};

global.disablePowerProcessing = function(roomName) {
    return _managers.powerSpawn.togglePowerProcessing(roomName, false);
};

global.setPowerMinEnergy = function(roomName, level) {
    return _managers.powerSpawn.setMinEnergyLevel(roomName, level);
};

// 主循环
module.exports.loop = function () {
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
            
            // 管理 Lab 反应和资源 (新增)
            _managers.lab.run(room);
            
            // 管理该房间的creep生成
            _managers.creep.manageCreeps(room, gameStage);

            // 运行PowerSpawn管理器
            _managers.powerSpawn.run(room);
        }
    }
    // 运行所有creep的逻辑
    _managers.creep.runCreeps();
    // 运行PowerCreep管理器
    _managers.powerCreep.run();
    
    // 状态扫描
    if(Game.time % 10 === 0) {
        stateScanner();
    }
};

// 状态扫描，每10tick运行一次，记录各房间能量和控制器等级状态
const stateScanner = function () {
    // 如果没有状态对象，创建
    if(!Memory.stats) Memory.stats = {};
    
    // 记录当前CPU使用
    Memory.stats.cpu = {
        used: Game.cpu.getUsed(),
        limit: Game.cpu.limit,
        bucket: Game.cpu.bucket
    };
    
    // 记录GCL (Global Control Level)
    Memory.stats.gcl = {
        level: Game.gcl.level,
        progress: Game.gcl.progress,
        progressTotal: Game.gcl.progressTotal
    };
    
    // 记录GPL (Global Power Level)
    Memory.stats.gpl = {
        level: Game.gpl.level,
        progress: Game.gpl.progress,
        progressTotal: Game.gpl.progressTotal
    };
    
    // 记录每个房间的状态
    Memory.stats.rooms = {};
    for(const name in Game.rooms) {
        const room = Game.rooms[name];
        
        // 只记录我们控制的房间
        if(room.controller && room.controller.my) {
            Memory.stats.rooms[name] = {
                energyAvailable: room.energyAvailable,
                energyCapacityAvailable: room.energyCapacityAvailable,
                controller: {
                    level: room.controller.level,
                    progress: room.controller.progress,
                    progressTotal: room.controller.progressTotal
                }
            };
            
            // 记录storage信息
            if(room.storage) {
                Memory.stats.rooms[name].storage = {
                    energy: room.storage.store[RESOURCE_ENERGY],
                    power: room.storage.store[RESOURCE_POWER] || 0
                };
            }
            
            // 记录终端信息
            if(room.terminal) {
                Memory.stats.rooms[name].terminal = {
                    energy: room.terminal.store[RESOURCE_ENERGY],
                    power: room.terminal.store[RESOURCE_POWER] || 0
                };
            }
        }
    }
};