const utils = require('utils');

/**
 * 收获者角色模块
 * 负责采集能量并将其输送到需要能量的建筑中
 */
const roleHarvester = {
    /**
     * Harvester的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 采集', '🚚 运输');

        // 寻找除STORAGE外需要能量的建筑
        const target = utils.findEnergyNeededStructureExceptStorage(creep.room);

        // 如果在工作模式（运输能量到建筑）
        if(creep.memory.working) {
            if(target) {
                // 尝试将能量转移到目标
                if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // 如果除STORAGE外的建筑都不缺能量
            else {
                // 去升级控制器
                if(creep.room.controller) {
                    creep.say('🔼 升级');
                    if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
            }
        }
        // 如果在采集模式
        else {
            // 如果有建筑需要能量
            if (target) {
                // 先检查存储结构是否有能量
                const storage = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return structure.structureType === STRUCTURE_STORAGE && 
                            structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                    }
                })[0];
                
                // 如果有存储且里面有能量，优先从存储中获取
                if(storage) {
                    creep.say('📦 拾走');
                    if(creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                }
                // 没有存储或存储为空，再检查容器
                else {
                    // 寻找能量源
                    const containers = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return structure.structureType === STRUCTURE_CONTAINER && 
                                structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                        }
                    })[0];

                    if(containers) {
                        creep.say('📦 拾走');
                        if(creep.withdraw(containers, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(containers, {visualizePathStyle: {stroke: '#ffaa00'}});
                        }
                    }
                    // 没有容器，再去能量源采集
                    else {
                        // 寻找能量源
                        const source = creep.pos.findClosestByPath(FIND_SOURCES);
                        
                        if(source) {
                            creep.say('⛏️ 采集');
                            if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                            }
                        }
                    }   
                }
            }
            // 没有建筑需要能量
            else {
                // 寻找能量源
                const source = creep.pos.findClosestByPath(FIND_SOURCES);
                    
                if(source) {
                    creep.say('⛏️ 采集');
                        // 尝试从能量源采集
                    if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
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