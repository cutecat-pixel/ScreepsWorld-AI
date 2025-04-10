const utils = require('utils');

/**
 * 转运者角色模块
 * 负责从容器、掉落的资源或墓碑中收集能量和化合物，并将其运输到STORAGE中
 */
const roleTransfer = {
    /**
     * Transfer的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 检查是否携带了任何非能量资源
        let hasNonEnergyResources = false;
        let nonEnergyType = '';
        for(const resourceType in creep.store) {
            if(resourceType !== RESOURCE_ENERGY && creep.store[resourceType] > 0) {
                hasNonEnergyResources = true;
                nonEnergyType = resourceType;
                break;
            }
        }
        
        // 如果携带了化合物，强制进入工作模式去存储
        if(hasNonEnergyResources && !creep.memory.working) {
            creep.memory.working = true;
            creep.say('📦 ' + nonEnergyType);
        } else {
            // 正常状态切换逻辑
            utils.switchWorkState(creep, '🔄', '📦');
        }
        
        // 如果在工作模式（存储资源到STORAGE）
        if(creep.memory.working) {
            this.storeResources(creep, hasNonEnergyResources);
        }
        // 如果在收集模式
        else {
            this.collectResources(creep, hasNonEnergyResources);
        }
    },
    
    /**
     * 存储资源的逻辑
     * @param {Creep} creep - 要控制的creep对象
     * @param {boolean} hasNonEnergyResources - 是否携带非能量资源
     */
    storeResources: function(creep, hasNonEnergyResources) {
        // 查找STORAGE
        const storage = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE
        })[0];
        
        if(storage) {
            // 找出creep携带的所有资源类型
            const resourceTypes = Object.keys(creep.store);
            
            if(resourceTypes.length > 0) {
                let resourceType = null;
                
                // 优先处理非能量资源
                if(hasNonEnergyResources) {
                    // 找到第一个非能量资源
                    for(const type of resourceTypes) {
                        if(type !== RESOURCE_ENERGY && creep.store[type] > 0) {
                            resourceType = type;
                            break;
                        }
                    }
                } else if(resourceTypes.includes(RESOURCE_ENERGY)) {
                    // 如果没有非能量资源，使用能量
                    resourceType = RESOURCE_ENERGY;
                }
                
                if(resourceType) {
                    // 显示当前正在处理的资源类型
                    creep.say('📦 ' + resourceType.substring(0, 4));
                    
                    const transferResult = creep.transfer(storage, resourceType);
                    if(transferResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {
                            visualizePathStyle: {
                                stroke: resourceType === RESOURCE_ENERGY ? '#ffffff' : '#ff00ff'
                            }
                        });
                    } else if(transferResult !== OK) {
                        // 如果转移失败（不是因为距离问题），输出错误
                        console.log(`Transfer ${creep.name} 转移 ${resourceType} 失败: ${transferResult}`);
                    }
                }
            }
        }
        // 如果没有STORAGE，考虑将能量运输到需要能量的建筑
        else if(creep.store[RESOURCE_ENERGY] > 0) {
            const target = utils.findEnergyNeededStructure(creep.room);
            
            if(target) {
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
        // 如果没有STORAGE且携带非能量资源，显示警告
        else if(hasNonEnergyResources) {
            creep.say('❌ 需要存储');
            
            // 检查房间内是否有已经定义的存储位置
            if(creep.room.memory.mineralStoragePos) {
                const pos = creep.room.memory.mineralStoragePos;
                creep.moveTo(new RoomPosition(pos.x, pos.y, creep.room.name), {
                    visualizePathStyle: {stroke: '#ff0000'},
                    range: 3
                });
            } else {
                // 如果没有定义存储位置，移动到房间中央
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ff0000'},
                    range: 10
                });
                
                // 记录当前位置作为临时存储点
                creep.room.memory.mineralStoragePos = {
                    x: 25,
                    y: 25
                };
            }
        }
    },
    
    /**
     * 收集资源的逻辑
     * @param {Creep} creep - 要控制的creep对象
     * @param {boolean} hasNonEnergyResources - 是否携带非能量资源
     */
    collectResources: function(creep, hasNonEnergyResources) {
        // 如果已经有化合物，立即切换到存储模式
        if(hasNonEnergyResources) {
            creep.memory.working = true;
            creep.say('📦');
            
            // 立即执行存储逻辑，不等待下一个tick
            this.storeResources(creep, true);
            return;
        }
        
        // 1. 高优先级：查找包含化合物的坟墓
        const tombstonesWithMinerals = creep.room.find(FIND_TOMBSTONES, {
            filter: tomb => {
                // 查找除能量外的任何资源
                for(const resourceType in tomb.store) {
                    if(resourceType !== RESOURCE_ENERGY && tomb.store[resourceType] > 0) {
                        return true;
                    }
                }
                return false;
            }
        });
        
        if(tombstonesWithMinerals.length > 0) {
            // 首先尝试找出最有价值的坟墓（包含多种化合物或数量多的）
            tombstonesWithMinerals.sort((a, b) => {
                // 获取a和b中的非能量资源总量
                let aValue = 0;
                let bValue = 0;
                
                for(const resourceType in a.store) {
                    if(resourceType !== RESOURCE_ENERGY) {
                        aValue += a.store[resourceType];
                    }
                }
                
                for(const resourceType in b.store) {
                    if(resourceType !== RESOURCE_ENERGY) {
                        bValue += b.store[resourceType];
                    }
                }
                
                return bValue - aValue; // 降序排列，最大值在前
            });
            
            const targetTomb = tombstonesWithMinerals[0];
            
            // 找出坟墓中第一种非能量资源
            let mineralType = null;
            for(const resourceType in targetTomb.store) {
                if(resourceType !== RESOURCE_ENERGY && targetTomb.store[resourceType] > 0) {
                    mineralType = resourceType;
                    break;
                }
            }
            
            if(mineralType) {
                creep.say('💎' + mineralType.substring(0, 4));
                const withdrawResult = creep.withdraw(targetTomb, mineralType);
                
                if(withdrawResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetTomb, {visualizePathStyle: {stroke: '#ff00ff'}});
                } else if(withdrawResult === OK) {
                    // 成功提取后，立即切换到存储模式
                    creep.memory.working = true;
                    
                    // 立即执行存储逻辑，不等待下一个tick
                    setTimeout(() => {
                        this.storeResources(creep, true);
                    }, 0);
                }
                return;
            }
        }
        
        // 2. 查找掉落的化合物资源
        const droppedMinerals = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType !== RESOURCE_ENERGY
        });
        
        if(droppedMinerals.length > 0) {
            // 按照数量排序
            droppedMinerals.sort((a, b) => b.amount - a.amount);
            const targetMineral = droppedMinerals[0];
            
            creep.say('💎' + targetMineral.resourceType.substring(0, 4));
            const pickupResult = creep.pickup(targetMineral);
            
            if(pickupResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetMineral, {visualizePathStyle: {stroke: '#ff00ff'}});
            } else if(pickupResult === OK) {
                // 成功拾取后，立即切换到存储模式
                creep.memory.working = true;
                
                // 立即执行存储逻辑，不等待下一个tick
                setTimeout(() => {
                    this.storeResources(creep, true);
                }, 0);
            }
            return;
        }
        
        // 如果没有化合物或creep已满，继续默认的能量收集逻辑
        this.collectEnergy(creep);
    },
    
    /**
     * 收集能量的逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    collectEnergy: function(creep) {
        // 优先考虑从容器、墓碑或掉落的资源中获取能量
        let source = null;
        
        // 查找装满能量的容器
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                      s.store.getUsedCapacity(RESOURCE_ENERGY) > creep.store.getFreeCapacity(RESOURCE_ENERGY)
        });
        
        // 按照能量量排序容器
        if(containers.length > 0) {
            containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
            source = containers[0];
        }
        
        // 如果没有合适的容器，查找掉落的能量
        if(!source) {
            const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
            });
            
            if(droppedResources.length > 0) {
                // 按照数量排序资源
                droppedResources.sort((a, b) => b.amount - a.amount);
                source = droppedResources[0];
            }
        }
        
        // 如果没有掉落的资源，查找有能量的墓碑
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
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        // 转运者主要需要CARRY和MOVE部件
        if(gameStage.level >= 7 && energy >= 1800) {
            // 后期阶段配置，更大容量
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                   CARRY, CARRY, CARRY, CARRY, CARRY,
                   MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                   MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 4 && energy >= 800) {
            // 高级阶段配置，大量CARRY和匹配的MOVE
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
                   MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 500) {
            // 中级阶段配置
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, 
                   MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else {
            // 基础配置
            body = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleTransfer; 