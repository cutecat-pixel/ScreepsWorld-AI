/**
 * 占领者角色
 * 负责占领其他房间的控制器
 */
const claimerRole = {
    /**
     * 获取占领者的身体部件配置
     * @param {number} energyAvailable - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energyAvailable, gameStage) {
        // 基础配置 - 占领者只需要CLAIM和MOVE部件
        let body = [CLAIM, MOVE];
        
        // 更高级的配置，可以更快占领
        if(energyAvailable >= 1300 && gameStage.level >= 5) {
            body = [CLAIM, CLAIM, MOVE, MOVE];
        }
        
        return body;
    },
    
    /**
     * 运行占领者逻辑
     * @param {Creep} creep - Creep对象
     */
    run: function(creep) {
        // 如果占领者不在目标房间，前往目标房间
        if(creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}});
            creep.say('前往');
            return;
        }
        
        // 获取目标房间的控制器
        const controller = creep.room.controller;
        
        // 如果控制器存在且不属于自己
        if(controller) {
            let actionResult;
            
            // 根据行动模式执行不同操作
            if(creep.memory.mode === 'attack') {
                // 攻击控制器以降级它
                actionResult = creep.attackController(controller);
            } else if(creep.memory.mode === 'reserve') {
                // 预定控制器
                actionResult = creep.reserveController(controller);
            } else {
                // 默认占领控制器
                actionResult = creep.claimController(controller);
            }
            
            // 如果不在范围内，移动到控制器
            if(actionResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffaa00'}});
                
                // 根据行动模式显示不同的表情
                if(creep.memory.mode === 'attack') {
                    creep.say('攻击');
                } else if(creep.memory.mode === 'reserve') {
                    creep.say('预定');
                } else {
                    creep.say('占领');
                }
            } else if(actionResult === ERR_GCL_NOT_ENOUGH) {
                // 如果GCL不足，切换到预定模式
                console.log(`GCL不足，无法占领 ${creep.room.name}，切换为预定模式`);
                creep.memory.mode = 'reserve';
            } else if(actionResult !== OK) {
                // 输出其他错误
                console.log(`占领操作失败，错误代码: ${actionResult}`);
            }
        }
    },
    
    /**
     * 创建占领任务请求
     * @param {string} sourceRoomName - 源房间名称
     * @param {string} targetRoomName - 目标房间名称
     * @param {string} mode - 占领模式: 'claim', 'reserve', 'attack'
     */
    createClaimTask: function(sourceRoomName, targetRoomName, mode = 'claim') {
        // 确保有生成队列
        if(!Memory.spawnQueue) {
            Memory.spawnQueue = {};
        }
        
        if(!Memory.spawnQueue[sourceRoomName]) {
            Memory.spawnQueue[sourceRoomName] = [];
        }
        
        // 添加到生成队列
        Memory.spawnQueue[sourceRoomName].push({
            role: 'claimer',
            priority: 2, // 高优先级
            memory: {
                role: 'claimer',
                homeRoom: sourceRoomName,
                targetRoom: targetRoomName,
                mode: mode,
                working: false
            }
        });
        
        console.log(`已添加占领任务: 从 ${sourceRoomName} 派出占领者至 ${targetRoomName}, 模式: ${mode}`);
    }
};

module.exports = claimerRole; 