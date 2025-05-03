const utils = require('utils');

// 新增常量
const CONTAINER_LOW_ENERGY_THRESHOLD = 500; // 当分配的容器能量低于此值时，transfer可能变为空闲
const HELP_TARGET_MIN_ENERGY = 1200;       // 帮助目标容器至少需要多少能量
const MIN_WITHDRAW_AMOUNT = 1200;             // 帮助或收集时目标至少需要的能量
const LINK_CHECK_RANGE = 2;                 // 检查Container附近多远范围内的LINK

/**
 * 转运者角色模块
 * 优先处理非能量资源。
 * 当房间有 Storage 时：
 *   - 每个 Transfer Creep 会被分配一个 Container，专门负责将其中的能量搬运到 Storage。
 *   - 会优先收集/存储非能量资源（来自墓碑/掉落物）。
 *   - 不处理附近有LINK的Container，那些由LINK网络负责传输能量。
 * 当房间没有 Storage 时：
 *   - 从容器、掉落物、墓碑收集能量/化合物，优先化合物。
 *   - 将资源存入 Storage（如果后来建了）或 Spawn/Extension/Tower，或用于升级。
 */
const roleTransfer = {
    MIN_WITHDRAW_AMOUNT: MIN_WITHDRAW_AMOUNT, // 让常量在对象内部可用
    /**
     * Transfer的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        const room = creep.room;
        const storage = room.storage;
        
        // 初始化房间内存中的已分配容器列表
        if (storage && !room.memory.assignedContainers) {
            room.memory.assignedContainers = [];
        }

        // 优先处理非能量收集
        const nonEnergyStatus = this.collectNonEnergy(creep);
        
        // 如果正在移动去收集或正在积极收集中，则本tick结束
        if (nonEnergyStatus === 'MOVING' || nonEnergyStatus === 'COLLECTING_ACTIVE') {
            return;
        }

        // 根据容量和非能量收集状态决定工作状态
        if (creep.store.getUsedCapacity() > 0 || nonEnergyStatus === 'FULL') {
           creep.memory.working = true;
        } else {
           creep.memory.working = false;
           // 清理非工作状态下的记忆
           delete creep.memory.collectingNonEnergyTarget;
           delete creep.memory.helpingContainerId;
           // 如果是从 FULL 状态转换过来的，working 会在下一 tick 开始时设置为 false
        }

        // --- 主要逻辑分支 ---
        if (creep.memory.working) {
            // 存储模式
            this.storeResources(creep, storage);
        } else { // 只有在非工作状态，且非能量收集返回 false 时才收集能量
            if (storage) {
                this.collectEnergyWithHelpLogic(creep, storage);
            } else {
                this.collectEnergyLegacy(creep);
            }
        }
    },
    
    /**
     * 存储资源的逻辑 (优先非能量)
     * @param {Creep} creep
     * @param {StructureStorage} storage - 可能为 null
     */
    storeResources: function(creep, storage) {
        let target = null;
        let resourceToStore = null;
        
        // 查找第一个要存储的资源 (优先非能量)
        for(const type in creep.store) {
            if(type !== RESOURCE_ENERGY && creep.store[type] > 0) {
                resourceToStore = type;
                break;
            }
        }
        // 如果没有非能量资源，检查是否有能量
        if (!resourceToStore && creep.store[RESOURCE_ENERGY] > 0) {
            resourceToStore = RESOURCE_ENERGY;
        }
        
        // 如果无资源可存 (理论上不应发生)，重置状态
        if (!resourceToStore) {
             creep.memory.working = false; 
             return;
        }
        
        // 确定存储目标 (优先Storage)
        if (storage) {
            target = storage;
        } else if (resourceToStore === RESOURCE_ENERGY) {
            // 无Storage时，能量存入其他建筑
            target = utils.findEnergyNeededStructure(creep.room);
        }
        // 如果是非能量资源且无Storage，或能量无处可存
        if (!target) {
            if (resourceToStore !== RESOURCE_ENERGY) {
                creep.say('❌ Store ' + resourceToStore.substring(0,2));
                const mineralPos = creep.room.memory.mineralStoragePos || { x: 25, y: 25 }; 
                creep.moveTo(new RoomPosition(mineralPos.x, mineralPos.y, creep.room.name), { visualizePathStyle: { stroke: '#ff0000' }, range: 1 });
                return;
            } else {
                 // 能量无处可放，尝试升级
                target = creep.room.controller;
                 if(target && creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                 }
                 return;
            }
        }

        // 执行存储
        creep.say('📦' + resourceToStore.substring(0,2));
        const result = creep.transfer(target, resourceToStore);
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: resourceToStore === RESOURCE_ENERGY ? '#ffffff' : '#ff00ff' } });
        } else if (result === ERR_FULL) {
            creep.say('⛔');
        } else if (result !== OK) {
            console.log(`Transfer ${creep.name} 存储 ${resourceToStore} 到 ${target.structureType || 'controller'} 失败: ${result}`);
        }
    },

    /**
     * 优先收集非能量资源 (墓碑/掉落物)
     * @param {Creep} creep 
     * @returns {string|false} 返回状态: 'MOVING', 'COLLECTING_ACTIVE', 'FULL', false
     */
    collectNonEnergy: function(creep) {
        // 如果已满，直接返回false，让run函数处理
        if (creep.store.getFreeCapacity() === 0) {
            return false;
        }
        
        let targetSource = null;
        let targetType = null; // 'tombstone' or 'dropped'
        
        // 优先找包含化合物的坟墓
        const tombstonesWithMinerals = creep.room.find(FIND_TOMBSTONES, {
            filter: tomb => Object.keys(tomb.store).some(r => r !== RESOURCE_ENERGY && tomb.store[r] > 0)
        });
        
        if(tombstonesWithMinerals.length > 0) {
            targetSource = creep.pos.findClosestByPath(tombstonesWithMinerals);
            targetType = 'tombstone';
        }
        
        // 如果没有合适的坟墓，找掉落的化合物
        if(!targetSource) {
            const droppedMinerals = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType !== RESOURCE_ENERGY
            });
            if(droppedMinerals.length > 0) {
                targetSource = creep.pos.findClosestByPath(droppedMinerals);
                targetType = 'dropped';
            }
        }
        
        // 如果没有找到目标，返回false
        if (!targetSource) {
            delete creep.memory.collectingNonEnergyTarget; // 清理可能残留的目标
            return false;
        }
        
        // 如果当前目标和内存中记录的不一致，可能是旧目标消失了，重新评估
        if (creep.memory.collectingNonEnergyTarget && creep.memory.collectingNonEnergyTarget !== targetSource.id) {
            delete creep.memory.collectingNonEnergyTarget;
            return false; // 让下一tick重新寻找
        }
        
        creep.memory.collectingNonEnergyTarget = targetSource.id;
        
        // 如果不在目标旁边，移动过去
        if (!creep.pos.isNearTo(targetSource)) {
            creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ff00ff' } });
            creep.say('💎 Go');
            return 'MOVING'; // 正在移动
        }
        
        // 在目标旁边，尝试收集所有非能量资源
        let collectedSomethingThisTick = false;
        
        if (targetType === 'tombstone') {
            for (const resourceType in targetSource.store) {
                if (resourceType !== RESOURCE_ENERGY && targetSource.store[resourceType] > 0) {
                    const amountToWithdraw = Math.min(targetSource.store[resourceType], creep.store.getFreeCapacity());
                    if (amountToWithdraw > 0) {
                        const result = creep.withdraw(targetSource, resourceType, amountToWithdraw);
                        if (result === OK) {
                            creep.say('💎+' + resourceType.substring(0, 2));
                            collectedSomethingThisTick = true;
                            // 检查是否满了
                            if (creep.store.getFreeCapacity() === 0) {
                                delete creep.memory.collectingNonEnergyTarget; // 完成收集
                                return 'FULL'; // 收集后满了
                            }
                        } else if (result === ERR_FULL) {
                            delete creep.memory.collectingNonEnergyTarget; // 完成收集（因为满了）
                            return 'FULL'; // 尝试收集但发现已满
                        } else if (result !== ERR_NOT_ENOUGH_RESOURCES) {
                             console.log(`${creep.name} withdraw ${resourceType} from tombstone failed: ${result}`);
                             // 如果出错，暂时跳过这种资源
                        }
                        // 如果是ERR_NOT_ENOUGH_RESOURCES，继续尝试下一种资源
                    } else if (creep.store.getFreeCapacity() === 0) {
                         delete creep.memory.collectingNonEnergyTarget; // 完成收集
                        return 'FULL'; // 容量不足，无法收集更多
                    }
                }
            }
        } else if (targetType === 'dropped') {
            // 掉落的资源一次只能捡一种
            const result = creep.pickup(targetSource);
            if (result === OK) {
                creep.say('💎+' + targetSource.resourceType.substring(0, 2));
                collectedSomethingThisTick = true;
                 delete creep.memory.collectingNonEnergyTarget; // 捡起后目标消失
                // 检查是否满了
                if (creep.store.getFreeCapacity() === 0) {
                    return 'FULL'; // 收集后满了
                }
            } else if (result === ERR_FULL) {
                 delete creep.memory.collectingNonEnergyTarget; // 目标还在，但自己满了
                return 'FULL'; // 尝试收集但发现已满
            } else if (result === ERR_INVALID_TARGET) { // 目标可能已被别人捡走
                 delete creep.memory.collectingNonEnergyTarget;
                 return false; // 目标无效，结束收集
            } else {
                 console.log(`${creep.name} pickup ${targetSource.resourceType} failed: ${result}`);
                 // 其他错误，也结束本次尝试
                 delete creep.memory.collectingNonEnergyTarget;
                 return false;
            }
        }
        
        // 检查收集后状态
        if (collectedSomethingThisTick) {
            // 成功收集了东西，可能还有（如果是墓碑），继续保持收集状态
            return 'COLLECTING_ACTIVE';
        } else {
            // 在目标旁边，但本tick没有收集到任何东西（墓碑空了或掉落物消失）
            delete creep.memory.collectingNonEnergyTarget;
            return false;
        }
    },
    
    /**
     * 有 Storage 时的能量收集逻辑，包含帮助其他 Transfer 的逻辑
     * @param {Creep} creep
     * @param {StructureStorage} storage
     */
    collectEnergyWithHelpLogic: function(creep, storage) {
        // 1. 检查是否正在帮助某个 Container
        if (creep.memory.helpingContainerId) {
            const helpingContainer = Game.getObjectById(creep.memory.helpingContainerId);
            // 验证帮助目标是否仍然有效且有足够能量
            if (helpingContainer && helpingContainer.store[RESOURCE_ENERGY] >= this.MIN_WITHDRAW_AMOUNT) { 
                this.withdrawFromTarget(creep, helpingContainer, '#00ff00'); // 绿色路径表示帮助
                creep.say('🤝'); // 更清晰的Say
                return;
            } else {
                // 帮助目标无效或没能量了，清除帮助状态
                delete creep.memory.helpingContainerId;
            }
        }

        // 2. 处理自己分配的 Container
        let assignedContainerId = creep.memory.assignedContainerId;
        let container = assignedContainerId ? Game.getObjectById(assignedContainerId) : null;

        // 检查分配的 Container 是否有效
        if (!container) {
            if (assignedContainerId) {
                 this.unassignContainer(creep.room, assignedContainerId);
                 delete creep.memory.assignedContainerId;
                 assignedContainerId = null;
            }
        }

        // 3. 如果没有分配的 Container，尝试寻找并分配一个
        if (!assignedContainerId) {
            container = this.findAndAssignContainer(creep, storage);
            if (container) {
                assignedContainerId = container.id; 
                 this.withdrawFromTarget(creep, container, '#ffaa00');
                 creep.say('🎯');
                 return;
            } else {
                this.idleWaitNearStorage(creep, storage, '⏳ No Cont');
                return; 
            }
        }

        // 4. 如果有已分配的有效 Container
        if (container) {
            const currentEnergy = container.store[RESOURCE_ENERGY] || 0;
            
            // 检查能量是否过低，且自己是空的，可以考虑去帮助
            if (currentEnergy < CONTAINER_LOW_ENERGY_THRESHOLD && creep.store.getUsedCapacity() === 0) {
                const helpTargetContainer = this.findHelpTarget(creep, storage);
                if (helpTargetContainer) {
                    creep.memory.helpingContainerId = helpTargetContainer.id;
                    this.withdrawFromTarget(creep, helpTargetContainer, '#00ff00');
                    creep.say('🤝');
                    return;
                } else {
                     this.idleWaitNearStorage(creep, storage, '⏳');
                     return;
                }
            } else {
                // 能量充足，或者自己身上有货，从自己的 Container 取货
                this.withdrawFromTarget(creep, container, '#ffaa00');
                creep.say(' C ' + container.id.slice(-2));
                return;
            }
        }
    },
    
    /**
     * 尝试从目标 (Container) 取货
     * @param {Creep} creep
     * @param {StructureContainer} targetContainer
     * @param {string} pathColor 
     */
    withdrawFromTarget: function(creep, targetContainer, pathColor = '#ffaa00') {
        const result = creep.withdraw(targetContainer, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(targetContainer, { visualizePathStyle: { stroke: pathColor } });
        } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
            // 目标空了
            if (creep.memory.helpingContainerId === targetContainer.id) {
                delete creep.memory.helpingContainerId;
                creep.say('🤝');
            } else if (creep.memory.assignedContainerId === targetContainer.id) {
                 this.unassignContainer(creep.room, targetContainer.id);
                 delete creep.memory.assignedContainerId;
                 creep.say(' C empty');
            }
        } else if (result === ERR_FULL) {
            // 自己满了，应该切换到 working 状态
             creep.memory.working = true;
        }
    },

    /**
     * 寻找并分配一个未被占用的 Container 给 Creep
     * @param {Creep} creep 
     * @param {StructureStorage} storage
     * @returns {StructureContainer | null} 分配到的 Container 或 null
     */
    findAndAssignContainer: function(creep, storage) {
        if (!creep.room.memory.assignedContainers) creep.room.memory.assignedContainers = [];
        
        const allContainers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 50
        });
        
        // 过滤出未分配且附近没有LINK的Container
        const eligibleContainers = allContainers.filter(container => {
            const isUnassigned = !creep.room.memory.assignedContainers.includes(container.id);
            if(!isUnassigned) return false;
            
            const nearbyLinks = container.pos.findInRange(FIND_MY_STRUCTURES, LINK_CHECK_RANGE, {
                filter: s => s.structureType === STRUCTURE_LINK
            });
            
            return nearbyLinks.length === 0;
        });
        
        if (eligibleContainers.length > 0) {
            const targetContainer = creep.pos.findClosestByPath(eligibleContainers);
            if (targetContainer) {
                creep.memory.assignedContainerId = targetContainer.id;
                creep.room.memory.assignedContainers.push(targetContainer.id);
                return targetContainer;
            } else {
                creep.say('🚧');
                return null;
            }
        } else {
            return null;
        }
    },
    
    /**
     * 查找一个适合帮助的 Container
     * @param {Creep} creep
     * @param {StructureStorage} storage
     * @returns {StructureContainer | null} 适合帮助的 Container 或 null
     */
    findHelpTarget: function(creep, storage) {
         if (!creep.room.memory.assignedContainers) return null;
         
         const potentialTargets = creep.room.memory.assignedContainers
            .map(id => Game.getObjectById(id)) // 获取对象
            .filter(c => 
                 c && // 确保对象存在
                 c.id !== creep.memory.assignedContainerId && // 不是自己的 container
                 c.store[RESOURCE_ENERGY] >= HELP_TARGET_MIN_ENERGY // 能量充足
             );
             
        if (potentialTargets.length > 0) {
             return creep.pos.findClosestByPath(potentialTargets);
        }
        
        return null;
    },
    
    /**
     * 解除对 Container 的分配
     * @param {Room} room
     * @param {string} containerId 
     */
    unassignContainer: function(room, containerId) {
         if (room.memory.assignedContainers) {
             _.remove(room.memory.assignedContainers, id => id === containerId);
         }
    },
    
    /**
     * Creep 在 Storage 附近等待
     * @param {Creep} creep
     * @param {StructureStorage} storage
     * @param {string} sayMsg 
     */
    idleWaitNearStorage: function(creep, storage, sayMsg = '⏳') {
        creep.say(sayMsg);
        if (storage && !creep.pos.isNearTo(storage)) {
            creep.moveTo(storage, { visualizePathStyle: { stroke: '#cccccc' }, range: 3 });
        }
    },

    /**
     * 收集能量的逻辑 (旧版，无 Storage 时使用)
     * @param {Creep} creep - 要控制的creep对象
     */
    collectEnergyLegacy: function(creep) {
        let source = null;
        
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                      s.store.getUsedCapacity(RESOURCE_ENERGY) > creep.store.getFreeCapacity()
        });
        
        if(containers.length > 0) {
            containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
            source = containers[0];
        }
        
        if(!source) {
            const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
            });
            
            if(droppedResources.length > 0) {
                droppedResources.sort((a, b) => b.amount - a.amount);
                source = droppedResources[0];
            }
        }
        
        if(!source) {
            const tombstones = creep.room.find(FIND_TOMBSTONES, {
                filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
            });
            
            if(tombstones.length > 0) {
                source = tombstones[0];
            }
        }
        
        if(source) {
            let actionResult;
            
            if(source.store) {
                actionResult = creep.withdraw(source, RESOURCE_ENERGY);
            } else {
                actionResult = creep.pickup(source);
            }
            
            if(actionResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            } else if (actionResult === ERR_FULL) {
                 creep.memory.working = true;
            }
        }
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
        
        if(gameStage.level >= 7 && energy >= 1800) {
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                   CARRY, CARRY, CARRY, CARRY, CARRY,
                   MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                   MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 4 && energy >= 1200) {
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            }
        else if(gameStage.level >= 4 && energy >= 800) {
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
                   MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 500) {
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, 
                   MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else {
            body = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleTransfer; 