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
            
            // 只有transfer角色保留文字消息，其他角色全部使用emoji
            if(creep.memory.role === 'transfer') {
                if(collectMessage) creep.say(collectMessage);
            } else {
                // 为其他角色使用纯emoji
                creep.say('🔄');
            }
        }
        // 如果在采集模式并且能量已满，切换到工作模式
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            
            // 只有transfer角色保留文字消息，其他角色全部使用emoji
            if(creep.memory.role === 'transfer') {
                if(workMessage) creep.say(workMessage);
            } else {
                // 为其他角色选择合适的emoji
                if(creep.memory.role === 'harvester') creep.say('⚡');
                else if(creep.memory.role === 'builder') creep.say('🚧');
                else if(creep.memory.role === 'upgrader') creep.say('⬆️');
                else if(creep.memory.role === 'repairer') creep.say('🔧');
                else if(creep.memory.role === 'wallRepairer') creep.say('🧱');
                else if(creep.memory.role === 'hauler') creep.say('📦');
                else if(creep.memory.role === 'miner') creep.say('⛏️');
                else if(creep.memory.role === 'remoteHauler') creep.say('🚚');
                else if(creep.memory.role === 'remoteMiner') creep.say('🏔️');
                else creep.say('✅');
            }
        }
    },
    
    /**
     * 查找能量源（容器、掉落资源、存储或能量源）
     * @param {Creep} creep - 寻找能量的creep对象
     * @returns {Object} - 找到的能量源对象
     */
    findEnergySource: function(creep) {

        if (creep.room.controller.level >= 4) {
            const storage = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE && 
                            s.store[RESOURCE_ENERGY] > 0
            });
    
            if(storage) {
                return storage;
            }

            // 检查有能量的容器和存储
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_CONTAINER) && 
                            s.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity()
            });
            
            if(container) {
                return container;
            }
        }
        else {
            // 检查有能量的容器和存储
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_CONTAINER) && 
                            s.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity()
            });

            if(container) {
                return container;
            }

            const storage = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE && 
                            s.store[RESOURCE_ENERGY] > 0
            });
    
            if(storage) {
                return storage;
            }
        }

        // 检查附近是否有掉落的资源
        const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
        });

        if(droppedResources.length > 0) {
            // 按照数量排序资源
            droppedResources.sort((a, b) => b.amount - a.amount); 
            return droppedResources[0];;
        }

        
        
        // 然后检查墓碑中的能量
        const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] > 0
        });
        
        if(tombstone) {
            return tombstone;
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
        // 首先检查是否有需要能量的spawn或extension
        const spawnOrExtension = room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || 
                        s.structureType === STRUCTURE_EXTENSION) && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
        
        // 如果有需要能量的spawn或extension，优先返回
        if (spawnOrExtension) {
            return spawnOrExtension;
        }
        
        const tower = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];

        // 当所有spawn和extension都满能量后，考虑tower
        if(tower) {
            return tower;
        }
        
        // 如果tower满了，返回storage
        return room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
    },
    
    /**
     * 寻找除了STORAGE外最需要能量的建筑
     * @param {Room} room - 房间对象
     * @returns {Structure} - 最需要能量的结构，如果没有返回null
     */
    findEnergyNeededStructureExceptStorage: function(room) {
        // 首先检查是否有需要能量的spawn或extension
        const spawnOrExtension = room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || 
                        s.structureType === STRUCTURE_EXTENSION) && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
        
        // 如果有需要能量的spawn或extension，优先返回
        if (spawnOrExtension) {
            return spawnOrExtension;
        }
        
        // 当所有spawn和extension都满能量后，考虑tower
        const tower = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];

        if(tower) {
            return tower;
        }
        
        // 如果既没有spawn/extension需要能量，也没有tower需要能量，返回null
        return null;
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