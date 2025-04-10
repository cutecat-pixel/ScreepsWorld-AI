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