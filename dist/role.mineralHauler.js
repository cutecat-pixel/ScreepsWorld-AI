/**
 * 矿物运输者角色模块
 * 专门负责将矿物从容器运输至Storage
 */
const roleMineralHauler = {
    /**
     * 矿物运输者的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑
        if(creep.memory.hauling && creep.store.getFreeCapacity() === creep.store.getCapacity()) {
            creep.memory.hauling = false;
            creep.say('🔄 收集');
        }
        if(!creep.memory.hauling && creep.store.getFreeCapacity() === 0) {
            creep.memory.hauling = true;
            creep.say('📦 运输');
        }
        
        // 如果没有指定矿物容器，查找并分配
        if(!creep.memory.containerId) {
            this.findMineralContainer(creep);
        }
        
        // 运输模式：将收集的矿物送到Storage
        if(creep.memory.hauling) {
            // 检查是否有Storage
            const storage = creep.room.storage;
            if(!storage) {
                creep.say('❓无Storage');
                return;
            }
            
            // 尝试将矿物转移到Storage
            for(const resourceType in creep.store) {
                if(creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
                    break;
                }
            }
        }
        // 收集模式：从矿物容器中获取矿物
        else {
            // 检查矿物容器是否存在
            const container = Game.getObjectById(creep.memory.containerId);
            if(!container) {
                delete creep.memory.containerId;
                this.findMineralContainer(creep);
                return;
            }
            
            // 检查容器中是否有矿物资源
            let hasResources = false;
            for(const resourceType in container.store) {
                if(resourceType !== RESOURCE_ENERGY && container.store[resourceType] > 0) {
                    hasResources = true;
                    break;
                }
            }
            
            if(!hasResources) {
                creep.say('🕒 等资源');
                return;
            }
            
            // 从容器获取矿物资源
            for(const resourceType in container.store) {
                if(resourceType !== RESOURCE_ENERGY) {
                    if(creep.withdraw(container, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
                        break;
                    }
                }
            }
        }
    },
    
    /**
     * 查找矿物附近的容器
     * @param {Creep} creep - 需要查找容器的creep
     */
    findMineralContainer: function(creep) {
        // 查找房间中的矿物
        const minerals = creep.room.find(FIND_MINERALS);
        if(minerals.length === 0) {
            creep.say('❓无矿物');
            return;
        }
        
        // 查找矿物附近的容器
        const mineral = minerals[0];
        const containers = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        if(containers.length > 0) {
            creep.memory.containerId = containers[0].id;
            creep.say('✅找到容器');
        } else {
            creep.say('❓无容器');
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
        
        // 矿物运输者只需要CARRY和MOVE部件
        if(gameStage.level >= 7 && energy >= 1000) {
            // 高级阶段配置，大量CARRY和MOVE
            body = [
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else if(gameStage.level >= 6 && energy >= 600) {
            // 中级阶段配置
            body = [
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else {
            // 基础配置
            body = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleMineralHauler; 