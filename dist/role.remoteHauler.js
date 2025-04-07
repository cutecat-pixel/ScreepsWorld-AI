const utils = require('utils');

/**
 * 远程运输者角色模块
 * 负责从远程房间（通常是被预定的房间）收集能量，并将其运输回主房间
 */
const roleRemoteHauler = {
    /**
     * RemoteHauler的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 收集', '📦 运输');
        
        // 如果在工作模式（分发能量）需要回到主房间
        if(creep.memory.working) {
            // 如果不在主房间，返回主房间
            if(creep.memory.homeRoom && creep.room.name !== creep.memory.homeRoom) {
                const exitDir = Game.map.findExit(creep.room, creep.memory.homeRoom);
                const exit = creep.pos.findClosestByPath(exitDir);
                creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffffff'}});
                return;
            }

            // 已经在主房间，寻找需要能量的建筑
            const target = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE && 
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            })[0];

            if(target) {
                // 尝试将能量转移到目标
                if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }

            // 如果所有建筑都满了，检查是否主房间所有能量存储设施都满了
            else {
                // 换到待命状态
                creep.memory.waiting = true;
                    
                // 移动到房间中心待命区域
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffff00'},
                    range: 10
                });
            }
        }
        // 如果在收集模式，需要去目标房间收集能量
        else {
            // 清除待命状态
            creep.memory.waiting = false;
            
            // 如果不在目标房间，前往目标房间
            if(creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
                const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
                const exit = creep.pos.findClosestByRange(exitDir);
                creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}});
                return;
            }
            
            // 已经在目标房间，寻找能量来源
            // 优先考虑从容器、墓碑或掉落的资源中获取能量
            let source = null;
            
            // 查找装满能量的容器
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && 
                          s.store.getUsedCapacity(RESOURCE_ENERGY) > 50
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
     * 检查主房间的能量存储是否已满
     * @param {Room} room - 房间对象
     * @returns {boolean} - 返回是否所有主要存储都已满
     */
    isMainRoomEnergyFull: function(room) {
        // 检查储存结构
        const storages = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE
        });
        
        if(storages.length > 0) {
            const storage = storages[0];
            // 如果存储器已超过90%容量，视为满
            if(storage.store.getUsedCapacity(RESOURCE_ENERGY) / storage.store.getCapacity(RESOURCE_ENERGY) > 0.9) {
                return true;
            }
        }
        
        // 检查容器
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        // 如果有容器并且都超过90%容量
        if(containers.length > 0) {
            let allFull = true;
            for(const container of containers) {
                if(container.store.getUsedCapacity(RESOURCE_ENERGY) / container.store.getCapacity(RESOURCE_ENERGY) < 0.9) {
                    allFull = false;
                    break;
                }
            }
            if(allFull) return true;
        }
        
        // 检查生产结构
        const spawns = room.find(FIND_MY_SPAWNS);
        const extensions = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        
        let spawnsFull = true;
        let extensionsFull = true;
        
        // 检查spawn是否都满
        for(const spawn of spawns) {
            if(spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                spawnsFull = false;
                break;
            }
        }
        
        // 检查extension是否都满
        for(const extension of extensions) {
            if(extension.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                extensionsFull = false;
                break;
            }
        }
        
        // 当生产结构和存储结构都满时，返回true
        return spawnsFull && extensionsFull && 
               (storages.length > 0 || containers.length > 0);
    },
    
    /**
     * 创建远程运输者任务请求
     * @param {string} sourceRoomName - 源房间名称
     * @param {string} targetRoomName - 目标房间名称
     */
    createRemoteHaulerTask: function(sourceRoomName, targetRoomName) {
        // 确保有生成队列
        if(!Memory.spawnQueue) {
            Memory.spawnQueue = {};
        }
        
        if(!Memory.spawnQueue[sourceRoomName]) {
            Memory.spawnQueue[sourceRoomName] = [];
        }
        
        // 添加到生成队列
        Memory.spawnQueue[sourceRoomName].push({
            role: 'remoteHauler',
            priority: 4, // 中等优先级
            memory: {
                role: 'remoteHauler',
                homeRoom: sourceRoomName,
                targetRoom: targetRoomName,
                working: false,
                waiting: false
            }
        });
        
        console.log(`已添加远程运输者任务: 从 ${sourceRoomName} 派出远程运输者至 ${targetRoomName}`);
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        if(gameStage.level >= 3 && energy >= 600) {
            // 中级阶段配置
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                   MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(energy >= 400) {
            // 基础配置
            body = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        }
        else {
            // 最小配置
            body = [CARRY, CARRY, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleRemoteHauler; 