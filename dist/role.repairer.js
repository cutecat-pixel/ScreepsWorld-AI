const utils = require('utils');

/**
 * 修理工角色模块
 * 专门负责修理结构
 */
const roleRepairer = {
    /**
     * Repairer的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 采集', '🔧 修理');
        
        // 如果在工作模式
        if(creep.memory.working) {
            // 查找需要修理的结构，按照损坏程度排序
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: object => object.hits < object.hitsMax
            });
            
            // 按照优先级给结构排序
            targets.sort((a, b) => {
                // 优先修理重要建筑
                const importantStructures = [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_CONTAINER, STRUCTURE_TOWER, STRUCTURE_ROAD];
                const aIsImportant = importantStructures.includes(a.structureType);
                const bIsImportant = importantStructures.includes(b.structureType);
                
                if (aIsImportant && !bIsImportant) return -1;
                if (!aIsImportant && bIsImportant) return 1;
                
                // 其次按照损坏程度排序
                const aHpPercent = a.hits / a.hitsMax;
                const bHpPercent = b.hits / b.hitsMax;
                
                return aHpPercent - bHpPercent;
            });
            
            // 墙壁和城墙的单独处理
            const walls = creep.room.find(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_WALL || 
                              s.structureType === STRUCTURE_RAMPART) && 
                              s.hits < 10000
            });
            
            // 如果有需要修理的普通建筑
            if(targets.length > 0) {
                // 尝试修理
                if(creep.repair(targets[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // 如果没有普通建筑需要修理，但有墙壁需要修理
            else if(walls.length > 0) {
                // 墙壁按照生命值排序
                walls.sort((a, b) => a.hits - b.hits);
                
                // 尝试修理最弱的墙壁
                if(creep.repair(walls[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(walls[0], {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // 如果什么都不需要修理，转为建造或升级
            else {
                // 查找建筑工地
                const constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
                if(constructionSite) {
                    // 尝试建造
                    if(creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(constructionSite, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                } 
                // 没有建筑工地，升级控制器
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
        if(gameStage.level >= 6 && energy >= 1000) {
            // 高级阶段配置，强化WORK和CARRY
            body = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 4 && energy >= 800) {
            // 高级阶段配置，强化WORK和CARRY
            body = [WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
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

module.exports = roleRepairer; 