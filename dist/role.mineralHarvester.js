/**
 * 矿物采集者角色模块
 * 专门负责从矿物(mineral)采集资源并放入附近的容器
 */
const roleMineralHarvester = {
    /**
     * 矿物采集者的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 如果没有分配目标矿物，查找并分配一个
        if(!creep.memory.mineralId) {
            this.assignMineral(creep);
        }
        
        // 获取分配的矿物
        const mineral = Game.getObjectById(creep.memory.mineralId);
        if(!mineral) {
            // 如果矿物不存在，重新分配
            this.assignMineral(creep);
            return;
        }
        
        // 查找矿物附近的容器
        if(!creep.memory.containerId) {
            const containers = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            if(containers.length > 0) {
                creep.memory.containerId = containers[0].id;
            } else {
                // 如果没有找到容器，说一声并等待
                creep.say('🔍');
                return;
            }
        }
        
        const container = Game.getObjectById(creep.memory.containerId);
        if(!container) {
            // 容器不存在，清除记忆中的容器ID
            delete creep.memory.containerId;
            return;
        }
        
        // 检查矿物是否有cooldown
        if(mineral.mineralAmount === 0) {
            creep.say('⏳');
            return;
        }
        
        // 如果不在容器上，移动到容器上
        if(!creep.pos.isEqualTo(container.pos)) {
            creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
            creep.say('🚶');
            return;
        }
        
        // 在容器上采集矿物
        const result = creep.harvest(mineral);
        if(result === OK) {
            creep.say('⛏️');
        } else if(result === ERR_NOT_IN_RANGE) {
            creep.moveTo(mineral, {visualizePathStyle: {stroke: '#ffaa00'}});
        } else if(result === ERR_NOT_FOUND) {
            // 矿物可能被删除，清除记忆
            delete creep.memory.mineralId;
        } else if (result === ERR_TIRED) {
            creep.say('💤');
        }
    },
    
    /**
     * 为矿物采集者分配一个矿物
     * @param {Creep} creep - 要分配矿物的creep
     */
    assignMineral: function(creep) {
        // 获取房间中的矿物
        const minerals = creep.room.find(FIND_MINERALS);
        if(minerals.length === 0) return;
        
        // 只需要分配第一个矿物
        creep.memory.mineralId = minerals[0].id;
        creep.say('🔄 分配矿物');
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        // 矿物采集者主要需要WORK部件和少量MOVE部件
        // 每个WORK部件每tick可以采集2单位矿物
        if(gameStage.level >= 7 && energy >= 1500) {
            // 高级阶段配置，大量WORK部件
            body = [
                WORK, WORK, WORK, WORK, WORK,
                WORK, WORK, WORK, WORK, WORK,
                MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else if(gameStage.level >= 6 && energy >= 750) {
            // 中级阶段配置
            body = [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
        }
        else {
            // 基础配置
            body = [WORK, WORK, WORK, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleMineralHarvester; 