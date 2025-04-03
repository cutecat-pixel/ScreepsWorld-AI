/**
 * 拆除者角色
 * 负责拆除敌方房间的建筑结构
 */
const dismantlerRole = {
    /**
     * 获取拆除者的身体部件配置
     * @param {number} energyAvailable - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energyAvailable, gameStage) {
        // 基础配置 - 最低能力的拆除者
        let body = [WORK, WORK, MOVE, MOVE];
        
        // 中等能量配置
        if(energyAvailable >= 400) {
            body = [WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE];
        }
        
        // 高能量配置
        if(energyAvailable >= 800) {
            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, 
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        
        // 游戏后期配置
        if(energyAvailable >= 1300) {
            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, 
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH];
        }
        
        return body;
    },
    
    /**
     * 运行拆除者逻辑
     * @param {Creep} creep - Creep对象
     */
    run: function(creep) {
        // 如果拆除者不在目标房间，前往目标房间
        if(creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}});
            creep.say('前往');
            return;
        }
        
        // 在目标房间中寻找并拆除目标
        let target = null;
        
        // 拆除优先级: 防御塔 > 生产建筑 > 其他建筑 > 墙壁/城墙 > 道路
        
        // 首先尝试拆除防御塔
        target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        // 然后尝试拆除生产建筑
        if(!target) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION ||
                            s.structureType === STRUCTURE_FACTORY ||
                            s.structureType === STRUCTURE_LAB
            });
        }
        
        // 然后拆除其他建筑
        if(!target) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType !== STRUCTURE_CONTROLLER &&
                            s.structureType !== STRUCTURE_WALL &&
                            s.structureType !== STRUCTURE_RAMPART &&
                            s.structureType !== STRUCTURE_ROAD
            });
        }
        
        // 最后拆除防御墙和城墙
        if(!target) {
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_WALL ||
                            s.structureType === STRUCTURE_RAMPART
            });
        }
        
        // 如果都没有敌方建筑，尝试拆除道路
        if(!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_ROAD
            });
        }
        
        // 如果找到目标，拆除它
        if(target) {
            if(creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
                creep.say('拆除');
            }
        } else {
            // 如果没有目标，在房间中心游荡
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                visualizePathStyle: {stroke: '#ffff00'},
                range: 10
            });
            creep.say('搜索');
        }
    },
    
    /**
     * 创建拆除任务请求
     * @param {string} sourceRoomName - 源房间名称
     * @param {string} targetRoomName - 目标房间名称
     * @param {number} count - 派出的拆除者数量
     */
    createDismantleTask: function(sourceRoomName, targetRoomName, count = 1) {
        // 确保有生成队列
        if(!Memory.spawnQueue) {
            Memory.spawnQueue = {};
        }
        
        if(!Memory.spawnQueue[sourceRoomName]) {
            Memory.spawnQueue[sourceRoomName] = [];
        }
        
        // 根据请求的数量创建多个拆除者
        for(let i = 0; i < count; i++) {
            // 添加到生成队列
            Memory.spawnQueue[sourceRoomName].push({
                role: 'dismantler',
                priority: 3, // 较高优先级
                memory: {
                    role: 'dismantler',
                    homeRoom: sourceRoomName,
                    targetRoom: targetRoomName,
                    working: false
                }
            });
        }
        
        console.log(`已添加拆除任务: 从 ${sourceRoomName} 派出 ${count} 个拆除者至 ${targetRoomName}`);
    }
};

module.exports = dismantlerRole; 