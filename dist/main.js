// 导入各个模块
const _managers = require('_managers');
const _roles = require('_roles');

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

/**
 * Screeps主逻辑入口
 * 每tick会自动调用这个函数
 */
module.exports.loop = function() {
    // 清理内存
    _managers.memory.cleanupMemory();
    
    // 处理入侵任务
    _managers.invasion.processInvasions();
    
    // 遍历所有房间
    for(const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        
        // 确保只针对我们控制的房间运行代码
        if(room.controller && room.controller.my) {
            // 获取当前游戏阶段
            const gameStage = _managers.gameStage.getCurrentStage();
            
            // 处理房间中的防御塔
            _managers.tower.manageTowers(room);
            
            // 管理该房间的creep生成
            _managers.creep.manageCreeps(room, gameStage);
        }
    }
    
    // 运行所有creep的逻辑
    _managers.creep.runCreeps();
    
    // 每100个tick报告一次统计信息
    if(Game.time % 100 === 0) {
        _managers.memory.reportStats();
    }
};