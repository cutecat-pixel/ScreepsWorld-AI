const utils = require('utils');

/**
 * 收获者角色模块
 * 负责从能量源采集能量并将其输送到需要能量的建筑中
 */
const roleHarvester = {
    /**
     * Harvester的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 采集', '🚚 运输');
        
        // 如果在工作模式（运输能量到建筑）
        if(creep.memory.working) {
            // 寻找需要能量的建筑
            const target = utils.findEnergyNeededStructure(creep.room);
            
            if(target) {
                // 尝试将能量转移到目标
                if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // 如果所有建筑都满了，考虑升级控制器
            else if(creep.room.controller) {
                if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
        // 如果在采集模式
        else {
            // 寻找能量源
            const source = creep.pos.findClosestByPath(FIND_SOURCES);
            
            if(source) {
                // 尝试从能量源采集
                if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
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
        if(gameStage.level >= 4 && energy >= 800) {
            // 高级阶段配置
            body = [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 550) {
            // 中级阶段配置
            body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
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

module.exports = roleHarvester; 