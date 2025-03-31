const utils = require('utils');

/**
 * 运输者角色模块
 * 负责从容器或掉落的资源中收集能量，并将其运输到需要能量的结构中
 */
const roleHauler = {
    /**
     * Hauler的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 收集', '📦 运输');
        
        // 如果在工作模式（分发能量）
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
        // 如果在收集模式
        else {
            // 优先考虑从容器、墓碑或掉落的资源中获取能量
            let source = null;
            
            // 查找装满能量的容器
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && 
                          s.store.getUsedCapacity(RESOURCE_ENERGY) > creep.store.getFreeCapacity()
            });
            
            // 按照能量量排序容器
            if(containers.length > 0) {
                containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
                source = containers[0];
            }
            
            // 如果没有合适的容器，查找掉落的资源
            if(!source) {
                const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
                    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 100
                });
                
                if(droppedResources.length > 0) {
                    // 按照数量排序资源
                    droppedResources.sort((a, b) => b.amount - a.amount);
                    source = droppedResources[0];
                }
            }
            
            // 如果没有掉落的资源，查找墓碑
            if(!source) {
                const tombstones = creep.room.find(FIND_TOMBSTONES, {
                    filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                });
                
                if(tombstones.length > 0) {
                    source = tombstones[0];
                }
            }
            
            // 如果找到了能量源
            if(source) {
                let actionResult;
                
                // 根据源类型执行不同的操作
                if(source.store) {
                    // 容器或墓碑
                    actionResult = creep.withdraw(source, RESOURCE_ENERGY);
                } else {
                    // 掉落的资源
                    actionResult = creep.pickup(source);
                }
                
                if(actionResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
            // 如果找不到能量源，移动到房间中心等待
            else {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    range: 10
                });
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
        
        // 运输者主要需要CARRY和MOVE部件
        if(gameStage.level >= 4 && energy >= 800) {
            // 高级阶段配置，大量CARRY和匹配的MOVE
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
                   MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 500) {
            // 中级阶段配置
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, 
                   MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(energy >= 300) {
            // 基础配置
            body = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        else {
            // 最小配置
            body = [CARRY, CARRY, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleHauler; 