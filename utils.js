/**
 * 公共工具函数模块
 * 包含各种实用的游戏辅助功能
 */
const utils = {
    /**
     * 通用工作状态切换逻辑
     * @param {Creep} creep - 要切换状态的creep对象
     * @param {string} collectMessage - 采集模式的消息
     * @param {string} workMessage - 工作模式的消息
     */
    switchWorkState: function(creep, collectMessage, workMessage) {
        // 如果在工作模式并且能量为空，切换到采集模式
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            if(collectMessage) creep.say(collectMessage);
        }
        // 如果在采集模式并且能量已满，切换到工作模式
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            if(workMessage) creep.say(workMessage);
        }
    },
    
    /**
     * 查找能量源（容器、掉落资源、存储或能量源）
     * @param {Creep} creep - 寻找能量的creep对象
     * @returns {Object} - 找到的能量源对象
     */
    findEnergySource: function(creep) {
        // 首先检查附近是否有掉落的资源
        const droppedResource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
        });
        
        if(droppedResource) {
            return droppedResource;
        }
        
        // 然后检查墓碑中的能量
        const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] > 0
        });
        
        if(tombstone) {
            return tombstone;
        }
        
        // 检查有能量的容器和存储
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || 
                        s.structureType === STRUCTURE_STORAGE) && 
                        s.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity()
        });
        
        if(container) {
            return container;
        }
        
        // 最后，返回最近的可用能量源
        return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    },
    
    /**
     * 寻找最需要能量的spawn或扩展
     * @param {Room} room - 房间对象
     * @returns {Structure} - 最需要能量的结构
     */
    findEnergyNeededStructure: function(room) {
        return room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || 
                        s.structureType === STRUCTURE_EXTENSION) && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
    },
    
    /**
     * 判断一个房间是否安全
     * @param {Room} room - 房间对象
     * @returns {boolean} - 如果房间安全返回true
     */
    isRoomSafe: function(room) {
        // 如果没有房间对象，返回false
        if(!room) return false;
        
        // 检查是否有敌对creeps
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        return hostiles.length === 0;
    },
    
    /**
     * 获取一个房间内的建筑工地数量
     * @param {Room} room - 房间对象
     * @returns {number} - 建筑工地数量
     */
    getConstructionSiteCount: function(room) {
        return room.find(FIND_CONSTRUCTION_SITES).length;
    },
    
    /**
     * 获取房间能量百分比
     * @param {Room} room - 房间对象
     * @returns {number} - 能量百分比 (0-100)
     */
    getRoomEnergyPercent: function(room) {
        if(room.energyCapacityAvailable === 0) return 0;
        return (room.energyAvailable / room.energyCapacityAvailable) * 100;
    }
};

module.exports = utils; 