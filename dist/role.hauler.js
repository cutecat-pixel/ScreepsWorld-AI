const utils = require('utils');

/**
 * 运输者角色模块
 * 负责从STORAGE中获取能量，并将其运输到需要能量的结构中(SPAWN/EXTENSION/TOWER)和与STORAGE相邻的LINK
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
            // 检查是否已有目标
            let target = null;
            
            // 如果已经有目标且该目标还需要能量
            if(creep.memory.targetId) {
                const savedTarget = Game.getObjectById(creep.memory.targetId);
                if(savedTarget && savedTarget.store && savedTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = savedTarget;
                } else {
                    // 目标已满或不存在，清除目标ID
                    delete creep.memory.targetId;
                }
            }
            
            // 如果没有有效目标，寻找新目标
            if(!target) {
                target = this.findBestEnergyTarget(creep);
                if(target) {
                    creep.memory.targetId = target.id;
                }
            }
            
            if(target) {
                // 尝试将能量转移到目标
                if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                } else {
                    // 能量已成功转移，检查该建筑是否还需要更多能量
                    if(target.store.getFreeCapacity(RESOURCE_ENERGY) <= creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
                        // 目标已满或即将满，清除目标ID以便寻找新目标
                        delete creep.memory.targetId;
                    }
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
            // 检查是否有SPAWN、EXTENSION或TOWER需要能量
            const energyNeeded = creep.room.find(FIND_MY_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_SPAWN || 
                          s.structureType === STRUCTURE_EXTENSION || 
                          s.structureType === STRUCTURE_TOWER) && 
                          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            }).length > 0;
            
            // 如果有建筑需要能量且STORAGE有能量，优先从STORAGE获取
            if(energyNeeded || (creep.room.memory.links && creep.room.memory.links.storage && Game.getObjectById(creep.room.memory.links.storage).store.getFreeCapacity(RESOURCE_ENERGY) > 0)) {
                const storage = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_STORAGE && 
                              s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                })[0];
                
                if(storage) {
                    if(creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                    return;
                }
            }
            
            // 在高级阶段后，如果没有建筑需要能量，不执行收集资源的操作
            if(creep.room.controller.level >= 5 && !energyNeeded) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    range: 10
                });
                return;
            }
            
            // 以下情况会执行:
            // 1. 高级阶段前，有建筑需要能量但STORAGE没有能量
            // 2. 高级阶段前，没有建筑需要能量（收集资源到STORAGE）
            // 3. 高级阶段后，有建筑需要能量但STORAGE没有能量
            
            // 优先考虑从容器、墓碑或掉落的资源中获取能量
            let source = this.findBestEnergySource(creep);
            
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
                creep.moveTo(new RoomPosition(22, 20, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    range: 10
                });
            }
        }
    },
    
    /**
     * 寻找最佳能量目标（需要能量的建筑）
     * @param {Creep} creep - 要控制的creep对象
     * @returns {Structure|null} - 目标结构或null
     */
    findBestEnergyTarget: function(creep) {
        let targets = [];
        const creepEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        
        // 收集需要能量的spawn和extension，按优先级分组
        // 优先级1：即将孵化的spawn或将满的extension组
        // 优先级2：其他spawn和extension
        const spawnAndExtensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || 
                      s.structureType === STRUCTURE_EXTENSION) && 
                      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // 如果有spawn/extension需要能量，分组处理
        if(spawnAndExtensions.length > 0) {
            // 计算spawns中是否有正在孵化的，给予它们更高优先级
            const spawnPriority = _.filter(spawnAndExtensions, s => 
                s.structureType === STRUCTURE_SPAWN && s.spawning
            );
            
            // 将extensions按照位置分组，减少搬运路径
            const extensionGroups = this.groupExtensionsByPosition(creep.room, spawnAndExtensions);
            
            // 先处理优先级高的spawn，再处理extension组
            if(spawnPriority.length > 0) {
                targets = spawnPriority;
            } else if(extensionGroups.length > 0) {
                // 找到最密集的组，分配给该hauler
                let bestGroup = null;
                let shortestDistance = Infinity;
                
                for(const group of extensionGroups) {
                    // 计算到组中心的距离
                    const distance = creep.pos.getRangeTo(group.center.x, group.center.y);
                    if(distance < shortestDistance) {
                        shortestDistance = distance;
                        bestGroup = group;
                    }
                }
                
                if(bestGroup) {
                    // 标记该组，减少其他hauler前来
                    if(!creep.room.memory.haulerAssignments) {
                        creep.room.memory.haulerAssignments = {};
                    }
                    
                    creep.room.memory.haulerAssignments[creep.id] = {
                        groupId: bestGroup.id,
                        timestamp: Game.time
                    };
                    
                    // 最多取与自身能量相当的目标数量
                    targets = bestGroup.structures.slice(0, Math.ceil(creepEnergy / 50));
                }
            }
            
            // 如果没有优先建筑，选择最近的一个
            if(targets.length === 0 && spawnAndExtensions.length > 0) {
                targets = [this.findClosestTarget(creep, spawnAndExtensions)];
            }
        }
        
        // 如果没有spawn/extension需要能量，检查tower
        if(targets.length === 0) {
            let towers = creep.room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER && 
                          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            // 按能量缺口排序，优先补充能量少的塔
            if(towers.length > 0) {
                towers.sort((a, b) => a.store.getUsedCapacity(RESOURCE_ENERGY) - b.store.getUsedCapacity(RESOURCE_ENERGY));
                
                // 检查是否有其他hauler正在前往同一个tower
                const filteredTowers = _.filter(towers, tower => {
                    // 检查内存中是否有其他hauler已分配到这个tower
                    for(let id in Game.creeps) {
                        const otherCreep = Game.creeps[id];
                        if(otherCreep.id !== creep.id && 
                           otherCreep.memory.role === 'hauler' && 
                           otherCreep.memory.targetId === tower.id) {
                            return false;
                        }
                    }
                    return true;
                });
                
                // 如果有未分配的tower，选择能量最少的一个
                if(filteredTowers.length > 0) {
                    targets = [filteredTowers[0]];
                } else {
                    // 如果所有tower都已分配，选择最近的一个
                    targets = [this.findClosestTarget(creep, towers)];
                }
            }
            
            // 检查PowerSpawn是否需要能量，优先级在塔之后，但在储能LINK之前
            if(targets.length === 0) {
                const powerSpawns = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_POWER_SPAWN && 
                              s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                              s.store.getUsedCapacity(RESOURCE_ENERGY) < 2000 // 确保PowerSpawn至少有2000能量用于处理Power
                });
                
                if(powerSpawns.length > 0) {
                    // 检查是否有其他hauler正在前往PowerSpawn
                    const filteredPowerSpawns = _.filter(powerSpawns, ps => {
                        for(let id in Game.creeps) {
                            const otherCreep = Game.creeps[id];
                            if(otherCreep.id !== creep.id && 
                               otherCreep.memory.role === 'hauler' && 
                               otherCreep.memory.targetId === ps.id) {
                                return false;
                            }
                        }
                        return true;
                    });
                    
                    if(filteredPowerSpawns.length > 0) {
                        // 按能量量排序，选择能量最少的PowerSpawn
                        filteredPowerSpawns.sort((a, b) => 
                            a.store.getUsedCapacity(RESOURCE_ENERGY) - b.store.getUsedCapacity(RESOURCE_ENERGY)
                        );
                        targets = [filteredPowerSpawns[0]];
                        creep.say('⚡ 送能量');
                    }
                }
            }
            
            // 检查与STORAGE相邻的LINK是否需要能量
            if(targets.length === 0 && creep.room.memory.links && creep.room.memory.links.storage) {
                const storageLink = Game.getObjectById(creep.room.memory.links.storage);
                
                if(storageLink && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    targets = [storageLink];
                }
            }
            
            // 高级阶段前，如果以上建筑都不需要能量，则将能量送到STORAGE
            if(targets.length === 0 && creep.room.controller.level < 4) {
                const storage = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_STORAGE && 
                              s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                })[0];
                
                if(storage) {
                    targets = [storage];
                }
            }
        }
        
        // 返回最佳目标，优先考虑距离
        return targets.length > 0 ? this.findClosestTarget(creep, targets) : null;
    },
    
    /**
     * 寻找最佳能量来源
     * @param {Creep} creep - 要控制的creep对象
     * @returns {Object|null} - 能量来源或null
     */
    findBestEnergySource: function(creep) {
        let sources = [];
        
        // 查找装满能量的容器
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                      s.store.getUsedCapacity(RESOURCE_ENERGY) > 50
        });
        
        // 按照能量量排序容器
        if(containers.length > 0) {
            containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
            sources = sources.concat(containers);
        }
        
        // 查找掉落的资源
        const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 100
        });
        
        if(droppedResources.length > 0) {
            // 按照数量排序资源
            droppedResources.sort((a, b) => b.amount - a.amount);
            sources = sources.concat(droppedResources);
        }
        
        // 查找墓碑
        const tombstones = creep.room.find(FIND_TOMBSTONES, {
            filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 50
        });
        
        if(tombstones.length > 0) {
            sources = sources.concat(tombstones);
        }
        
        // 返回最近的能量源
        return sources.length > 0 ? this.findClosestTarget(creep, sources) : null;
    },
    
    /**
     * 根据距离寻找最近的目标
     * @param {Creep} creep - Creep对象
     * @param {Array} targets - 目标数组
     * @returns {Object|null} - 最近的目标或null
     */
    findClosestTarget: function(creep, targets) {
        if(!targets || targets.length === 0) return null;
        if(targets.length === 1) return targets[0];
        
        let closest = null;
        let shortestDistance = Infinity;
        
        for(const target of targets) {
            const distance = creep.pos.getRangeTo(target);
            if(distance < shortestDistance) {
                shortestDistance = distance;
                closest = target;
            }
        }
        
        return closest;
    },
    
    /**
     * 将extensions按位置分组，以便高效搬运
     * @param {Room} room - 房间对象
     * @param {Array} structures - 需要能量的结构
     * @returns {Array} - 分组后的结构组
     */
    groupExtensionsByPosition: function(room, structures) {
        // 如果房间没有缓存分组或缓存已过期
        if(!room.memory.extensionGroups || Game.time - (room.memory.extensionGroupsTime || 0) > 1000) {
            const extensions = _.filter(structures, s => s.structureType === STRUCTURE_EXTENSION);
            const groups = [];
            const RADIUS = 4; // 分组半径
            
            // 遍历所有extension，形成分组
            for(const extension of extensions) {
                // 检查是否能加入现有组
                let foundGroup = false;
                
                for(const group of groups) {
                    // 如果与组中心距离在半径内，加入该组
                    if(Math.abs(extension.pos.x - group.center.x) <= RADIUS && 
                       Math.abs(extension.pos.y - group.center.y) <= RADIUS) {
                        group.structures.push(extension);
                        // 更新组中心点
                        group.center.x = (group.center.x * (group.structures.length - 1) + extension.pos.x) / group.structures.length;
                        group.center.y = (group.center.y * (group.structures.length - 1) + extension.pos.y) / group.structures.length;
                        foundGroup = true;
                        break;
                    }
                }
                
                // 如果没找到合适的组，创建新组
                if(!foundGroup) {
                    groups.push({
                        id: Game.time + '_' + groups.length,
                        center: {
                            x: extension.pos.x,
                            y: extension.pos.y
                        },
                        structures: [extension]
                    });
                }
            }
            
            // 缓存分组结果
            room.memory.extensionGroups = groups;
            room.memory.extensionGroupsTime = Game.time;
            
            return groups;
        } else {
            // 使用缓存的分组，但更新里面的building引用
            const cachedGroups = room.memory.extensionGroups;
            const result = [];
            
            for(const group of cachedGroups) {
                const groupStructures = [];
                
                // 只考虑需要能量的结构
                for(const struct of structures) {
                    if(struct.structureType === STRUCTURE_EXTENSION) {
                        const distance = Math.sqrt(
                            Math.pow(struct.pos.x - group.center.x, 2) + 
                            Math.pow(struct.pos.y - group.center.y, 2)
                        );
                        
                        if(distance <= 4) {
                            groupStructures.push(struct);
                        }
                    }
                }
                
                if(groupStructures.length > 0) {
                    result.push({
                        id: group.id,
                        center: group.center,
                        structures: groupStructures
                    });
                }
            }
            
            return result;
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