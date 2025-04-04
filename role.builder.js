const utils = require('utils');

/**
 * 建造者角色模块
 * 负责建造新结构
 */
const roleBuilder = {
    /**
     * Builder的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 采集', '🚧 建造');
        
        // 如果在工作模式
        if(creep.memory.working) {
            // 寻找建筑工地
            const constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if(constructionSite) {
                // 尝试建造
                if(creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionSite, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // 如果没有建筑工地，尝试修理结构
            else {
                // 找出需要修理的结构（生命值低于最大生命值的75%）
                const structure = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => s.hits < s.hitsMax * 0.75 &&
                                  s.structureType !== STRUCTURE_WALL &&
                                  s.structureType !== STRUCTURE_RAMPART
                });
                
                if(structure) {
                    // 尝试修理
                    if(creep.repair(structure) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(structure, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
                // 如果没有需要修理的结构，转为升级控制器
                else {
                    if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
            }
        }
        // 如果在采集模式
        else {
            // 尝试从容器或储藏获取能量
            const energySource = utils.findEnergySource(creep);
            
            if(energySource) {
                // 根据能量源类型采取不同行动
                if(energySource.structureType) {
                    // 从结构中提取能量
                    if(creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(energySource, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                } else {
                    // 直接采集能量源
                    if(creep.harvest(energySource) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(energySource, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
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
            // 高级阶段配置，平衡WORK和CARRY
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

module.exports = roleBuilder; 