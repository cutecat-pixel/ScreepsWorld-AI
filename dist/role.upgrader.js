const utils = require('utils');

/**
 * 升级者角色模块
 * 专门负责升级房间控制器
 */
const roleUpgrader = {
    /**
     * Upgrader的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 采集', '⚡ 升级');
        
        // 如果在工作模式（升级控制器）
        if(creep.memory.working) {
            // 尝试升级控制器
            if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {
                    visualizePathStyle: {stroke: '#ffffff'}
                });
            }
        }
        // 如果在采集模式
        else {
            // 检查是否有控制器附近的LINK
            let controllerLink = null;
            
            // 根据link管理器中的memory结构检查控制器附近的LINK
            if(creep.room.controller && 
               creep.room.controller.level >= 5 && 
               creep.room.memory.links && 
               creep.room.memory.links.controller) {
                
                controllerLink = Game.getObjectById(creep.room.memory.links.controller);
            }
            
            // 如果有控制器LINK且有能量，优先从中获取
            if(controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if(creep.withdraw(controllerLink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controllerLink, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return;
            }
            
            // 如果没有控制器LINK或其能量为0，使用标准能量获取逻辑
            const energySource = utils.findEnergySource(creep);
            
            if(energySource) {
                let actionResult;
                
                // 根据能量源类型采取不同行动
                if(energySource.structureType) {
                    // 从结构中提取能量
                    actionResult = creep.withdraw(energySource, RESOURCE_ENERGY);
                } else if(energySource.resourceType) {
                    // 捡起掉落的资源
                    actionResult = creep.pickup(energySource);
                } else {
                    // 直接采集能量源
                    actionResult = creep.harvest(energySource);
                }
                
                // 如果需要移动到目标位置
                if(actionResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(energySource, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
        }
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        // 根据游戏阶段和能量调整身体部件
        if(gameStage.level >= 6 && energy >= 2300) {
            // 后期阶段配置，大量WORK用于高效升级
            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK ,WORK,
                    CARRY, CARRY, CARRY, CARRY,
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 4 && energy >= 1200) {
            // 后期阶段配置，大量WORK用于高效升级
            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY,
                   CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 800) {
            // 高级阶段配置，大量WORK和适量CARRY和MOVE
            body = [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 700) {
            // 中级阶段配置
            body = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        }
        else if(energy >= 400) {
            // 基础配置
            body = [WORK, WORK, CARRY, MOVE];
        }
        else {
            // 最小配置
            body = [WORK, CARRY, MOVE];
        }
        
        return body;
    }
};

module.exports = roleUpgrader; 