/**
 * 远程建造者角色模块
 * 负责前往指定房间进行建造，自行开采能源
 */
const roleRemoteBuilder = {
    /**
     * 远程建造者的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 如果creep正在工作但没有能量了，切换状态为获取能量
        if(creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.building = false;
            creep.say('🔄');
        }
        // 如果creep不在工作状态但能量已满，切换状态为建造
        if(!creep.memory.building && creep.store.getFreeCapacity() === 0) {
            creep.memory.building = true;
            creep.say('🚧');
        }
        
        // 检查是否有指定的目标房间
        if(creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            // 如果不在目标房间，移动到目标房间
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            if(exitDir === ERR_NO_PATH) {
                creep.say('❌');
                return;
            }
            
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 50
            });
            creep.say('🏃');
            return;
        }
        
        // 已经到达目标房间
        
        // 如果在建造状态
        if(creep.memory.building) {
            // 寻找建筑工地
            const targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            
            if(targets.length > 0) {
                // 按建筑类型优先级排序
                const sortedTargets = this.sortConstructionSitesByPriority(targets);
                
                // 尝试建造最高优先级的建筑
                if(creep.build(sortedTargets[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(sortedTargets[0], {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                    creep.say('🚧');
                }
            } else {
                // 如果没有建筑工地，可以选择修复建筑
                const structures = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => structure.hits < structure.hitsMax && 
                                         structure.structureType !== STRUCTURE_WALL &&
                                         structure.structureType !== STRUCTURE_RAMPART
                });
                
                // 按受损程度排序
                structures.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
                
                if(structures.length > 0) {
                    if(creep.repair(structures[0]) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(structures[0], {
                            visualizePathStyle: {stroke: '#ffff00'},
                            reusePath: 5
                        });
                        creep.say('🔧');
                    }
                } else {
                    // 没有任何建造或修复任务，随机移动避免堵塞
                    if(Game.time % 10 === 0) { 
                        creep.say('🔍');
                        creep.moveTo(25 + Math.floor(Math.random() * 10), 25 + Math.floor(Math.random() * 10), {
                            visualizePathStyle: {stroke: '#ffffff'}
                        });
                    }
                }
            }
        }
        // 如果在获取能量状态
        else {
            // 寻找能量来源：下落的资源、容器、或矿点
            let source = this.findEnergySource(creep);
            
            if(source) {
                if(source instanceof Resource) {
                    // 捡起掉落的资源
                    if(creep.pickup(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, {
                            visualizePathStyle: {stroke: '#ffaa00'},
                            reusePath: 5
                        });
                        creep.say('📥');
                    }
                } else if(source.structureType && source.store) {
                    // 从容器或存储中获取能量
                    if(creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, {
                            visualizePathStyle: {stroke: '#ffaa00'},
                            reusePath: 5
                        });
                        creep.say('📥');
                    }
                } else {
                    // 直接从矿点采集
                    if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, {
                            visualizePathStyle: {stroke: '#ffaa00'},
                            reusePath: 5
                        });
                        creep.say('⛏️');
                    }
                }
            } else {
                creep.say('❌');
                // 没有能源可用，随机移动避免堵塞
                creep.moveTo(25 + Math.floor(Math.random() * 10), 25 + Math.floor(Math.random() * 10), {
                    visualizePathStyle: {stroke: '#ffffff'}
                });
            }
        }
    },
    
    /**
     * 按优先级排序建筑工地
     * @param {Array} sites - 建筑工地数组
     * @returns {Array} - 排序后的建筑工地
     */
    sortConstructionSitesByPriority: function(sites) {
        return sites.sort((a, b) => {
            // 先对建筑类型按重要性排序
            const priority = {
                [STRUCTURE_SPAWN]: 1,
                [STRUCTURE_EXTENSION]: 2,
                [STRUCTURE_TOWER]: 3,
                [STRUCTURE_STORAGE]: 4,
                [STRUCTURE_LINK]: 5,
                [STRUCTURE_ROAD]: 6,
                [STRUCTURE_WALL]: 7,
                [STRUCTURE_RAMPART]: 8,
                [STRUCTURE_CONTAINER]: 9
            };
            
            // 获取建筑类型的优先级，没有定义的优先级最低
            const priorityA = priority[a.structureType] || 99;
            const priorityB = priority[b.structureType] || 99;
            
            // 按优先级排序
            if(priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // 如果优先级相同，按建造进度百分比排序（优先完成接近完成的建筑）
            const progressA = a.progress / a.progressTotal;
            const progressB = b.progress / b.progressTotal;
            return progressB - progressA;
        });
    },
    
    /**
     * 寻找能源来源
     * @param {Creep} creep - 当前creep
     * @returns {Object} - 能源对象（可能是掉落的资源、容器、存储或矿点）
     */
    findEnergySource: function(creep) {
        // 1. 首先寻找掉落的资源
        const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
        });
        
        if(droppedResources.length > 0) {
            // 按数量排序，优先拾取大量资源
            droppedResources.sort((a, b) => b.amount - a.amount);
            return droppedResources[0];
        }
        
        // 2. 寻找有能量的容器或存储
        const structures = creep.room.find(FIND_STRUCTURES, {
            filter: structure => 
                (structure.structureType === STRUCTURE_CONTAINER || 
                 structure.structureType === STRUCTURE_STORAGE) && 
                structure.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity()
        });
        
        if(structures.length > 0) {
            // 按能量数量排序
            structures.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
            return structures[0];
        }
        
        // 3. 最后寻找矿点
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        
        if(sources.length > 0) {
            // 找到最近的矿点
            return creep.pos.findClosestByPath(sources);
        }
        
        // 没有找到任何能源
        return null;
    },
    
    /**
     * 根据可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy) {
        // 基础身体部件：WORK, CARRY, MOVE, MOVE
        const Body = [WORK, CARRY, MOVE, MOVE];
        const basicCost = 250; // 100 + 50 + 50 + 50
        
        // 如果能量不足以生成基础身体，返回最小配置
        if(energy < basicCost) {
            return [WORK, CARRY, MOVE];
        }
        

        return Body;
    },
    
    /**
     * 创建远程建造者任务
     * @param {string} spawnRoomName - 出生房间名称
     * @param {string} targetRoomName - 目标房间名称
     * @param {number} count - 需要生成的数量
     * @param {number} priority - 生成优先级（可选，默认为2）
     * @returns {string} - 处理结果信息
     */
    createRemoteBuilderTask: function(spawnRoomName, targetRoomName, count, priority = 2) {
        // 确保生成队列存在
        if(!Memory.spawnQueue) {
            Memory.spawnQueue = {};
        }
        
        if(!Memory.spawnQueue[spawnRoomName]) {
            Memory.spawnQueue[spawnRoomName] = [];
        }
        
        // 配置远程建造者任务
        const config = {
            targetRoom: targetRoomName,
            count: count || 2 // 默认生成2个
        };
        
        // 将配置保存到内存中
        if(!Memory.remoteBuilders) {
            Memory.remoteBuilders = {};
        }
        
        Memory.remoteBuilders[targetRoomName] = config;
        
        // 检查当前远程建造者数量
        let currentCount = _.filter(Game.creeps, creep => 
            creep.memory.role === 'remoteBuilder' && 
            creep.memory.targetRoom === targetRoomName
        ).length;
        
        // 计算需要额外生成的数量
        const needToSpawn = Math.max(0, config.count - currentCount);
        
        // 添加到生成队列
        for(let i = 0; i < needToSpawn; i++) {
            Memory.spawnQueue[spawnRoomName].push({
                role: 'remoteBuilder',
                priority: priority,
                memory: {
                    role: 'remoteBuilder',
                    homeRoom: spawnRoomName,
                    targetRoom: targetRoomName,
                    building: false
                }
            });
        }
        
        console.log(`已添加远程建造者任务: 从 ${spawnRoomName} 派遣 ${needToSpawn} 个建造者至 ${targetRoomName}`);
        
        return `远程建造者任务已添加，将生成 ${needToSpawn} 个建造者前往 ${targetRoomName}`;
    },
    
    /**
     * 检查和维护远程建造者数量
     */
    maintainRemoteBuilders: function() {
        // 如果没有远程建造者配置，则返回
        if(!Memory.remoteBuilders) return;
        
        // 遍历所有目标房间的配置
        for(const targetRoomName in Memory.remoteBuilders) {
            const config = Memory.remoteBuilders[targetRoomName];
            
            // 跳过无效配置
            if(!config || !config.count || config.count <= 0) continue; // 添加了 count <= 0 的检查
            
            // 检查当前的远程建造者数量 (包括正在生成的)
            const currentCreeps = _.filter(Game.creeps, creep => 
                creep.memory.role === 'remoteBuilder' && 
                creep.memory.targetRoom === targetRoomName
            );
            const currentCount = currentCreeps.length;

            // 检查生成队列中是否已经有为该目标房间生成的请求
            let queuedCount = 0;
            for (const roomName in Memory.spawnQueue) {
                 if (Memory.spawnQueue[roomName]) {
                      queuedCount += _.filter(Memory.spawnQueue[roomName], request => 
                          request.memory && 
                          request.memory.role === 'remoteBuilder' && 
                          request.memory.targetRoom === targetRoomName
                      ).length;
                 }
            }

            // 如果当前数量 + 队列中的数量 < 期望数量，则添加一个生成请求
            if(currentCount + queuedCount < config.count) {
                // 找到所有可能的出生房间
                const possibleSpawnRooms = _.filter(Game.rooms, room => 
                    room.controller && room.controller.my && room.find(FIND_MY_SPAWNS).length > 0 &&
                    room.energyAvailable >= this.getRequiredEnergy() // 确保出生点能量足够
                );
                
                if(possibleSpawnRooms.length > 0) {
                    // 选择能量最充足或离目标最近的出生房间（这里简单选第一个）
                    // TODO: 可以加入更优的Spawn选择逻辑，比如计算距离
                    const spawnRoom = possibleSpawnRooms[0]; 
                    
                    // 确保该房间的生成队列存在
                    if(!Memory.spawnQueue) Memory.spawnQueue = {};
                    if(!Memory.spawnQueue[spawnRoom.name]) Memory.spawnQueue[spawnRoom.name] = [];

                    // 添加一个生成请求到该房间的生成队列
                    const spawnRequest = {
                        role: 'remoteBuilder',
                        priority: 2, // 可以从 config 中读取优先级
                        memory: {
                            role: 'remoteBuilder',
                            homeRoom: spawnRoom.name,
                            targetRoom: targetRoomName,
                            building: false
                        }
                    };
                    Memory.spawnQueue[spawnRoom.name].push(spawnRequest);
                    console.log(`RemoteBuilder Maintainer: Added 1 remoteBuilder spawn request for ${targetRoomName} to ${spawnRoom.name} queue. (Current: ${currentCount}, Queued: ${queuedCount}, Target: ${config.count})`);

                } else {
                     // 可选：记录无法找到合适spawn的日志
                     // console.log(`RemoteBuilder Maintainer: Could not find a suitable spawn room for ${targetRoomName}`);
                }
            }
        }
    },

    /**
     * 计算生成远程建造者所需的基础能量
     * (这个函数需要根据 getBody 的逻辑来确定)
     */
    getRequiredEnergy: function() {
        // 假设基础身体是 [WORK, CARRY, MOVE, MOVE]
        // 需要根据实际 getBody 逻辑调整
        const body = [WORK, CARRY, MOVE, MOVE]; 
        return _.sum(body, part => BODYPART_COST[part]);
    }
};

module.exports = roleRemoteBuilder; 