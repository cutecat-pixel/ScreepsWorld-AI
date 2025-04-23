const utils = require('utils');

// 新增常量
const CONTAINER_LOW_ENERGY_THRESHOLD = 500; // 当分配的容器能量低于此值时，transfer可能变为空闲
const HELP_TARGET_MIN_ENERGY = 1200;       // 帮助目标容器至少需要多少能量
const MIN_WITHDRAW_AMOUNT = 1200;             // 帮助或收集时目标至少需要的能量

/**
 * 转运者角色模块
 * 优先处理非能量资源。
 * 当房间有 Storage 时：
 *   - 每个 Transfer Creep 会被分配一个 Container，专门负责将其中的能量搬运到 Storage。
 *   - 会优先收集/存储非能量资源（来自墓碑/掉落物）。
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
        // 清理无效的已分配容器ID (可选，但推荐)
        // if (storage && Game.time % 100 === 0) { // 每100 tick清理一次
        //      room.memory.assignedContainers = room.memory.assignedContainers.filter(id => Game.getObjectById(id));
        // }

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
        
        // 如果携带了化合物，强制进入工作模式去存储 (无论是否有Storage)
        if(hasNonEnergyResources && !creep.memory.working) {
            creep.memory.working = true;
            creep.say('📦 ' + nonEnergyType.substring(0,2));
        } else if (!hasNonEnergyResources) {
            // 仅在不携带化合物时才进行常规状态切换
            utils.switchWorkState(creep, '🔄', '📦');
        }
        
        // --- 主要逻辑分支 ---
        if (creep.memory.working) {
            // 存储模式：优先存储化合物，然后是能量
            this.storeResources(creep, storage, hasNonEnergyResources);
            // 在存储完成后，检查是否之前在帮助，如果是，则清除帮助标记
            if (creep.store.getUsedCapacity() === 0 && creep.memory.helpingContainerId) {
                // console.log(`${creep.name} 完成帮助 ${creep.memory.helpingContainerId} 的运送，清除标记`);
                delete creep.memory.helpingContainerId;
            }
        } else {
            // 收集模式
            // 总是优先检查并拾取地上的非能量资源或墓碑中的非能量资源
            if (this.collectNonEnergy(creep)) {
                 return; 
            }
            
            // 如果没有非能量资源要处理，根据是否有 Storage 决定收集策略
            if (storage) {
                // 有 Storage：检查是否正在帮助，或是否应该去帮助，或从自己分配的 Container 收集
                this.collectEnergyWithHelpLogic(creep, storage);
            } else {
                // 无 Storage：使用旧的能量收集逻辑
                this.collectEnergyLegacy(creep);
            }
        }
    },
    
    /**
     * 存储资源的逻辑 (优先非能量)
     * @param {Creep} creep
     * @param {StructureStorage} storage - 可能为 null
     * @param {boolean} hasNonEnergyResources
     */
    storeResources: function(creep, storage, hasNonEnergyResources) {
        let target = null;
        let resourceToStore = null;
        
        // 确定要存储的资源类型 (优先非能量)
        if (hasNonEnergyResources) {
            for(const type in creep.store) {
                if(type !== RESOURCE_ENERGY && creep.store[type] > 0) {
                    resourceToStore = type;
                    break;
                }
            }
        } 
        // 如果没有非能量或已存完，存能量
        if (!resourceToStore && creep.store[RESOURCE_ENERGY] > 0) {
            resourceToStore = RESOURCE_ENERGY;
        }
        
        // 如果无资源可存，切换状态 (可能发生在捡了东西但下一tick又没了？)
        if (!resourceToStore) {
             creep.memory.working = false;
             return;
        }
        
        // 确定存储目标
        if (storage) {
            target = storage;
        } else if (resourceToStore === RESOURCE_ENERGY) {
            // 没有 Storage 时，能量可以存到 Spawn/Extension/Tower
            target = utils.findEnergyNeededStructure(creep.room);
        }
        // 如果是非能量资源且没有Storage，或者能量无处可存，去预设位置或升级
        if (!target) {
            if (resourceToStore !== RESOURCE_ENERGY) {
                 // 移动到预设的矿物存储点
                creep.say('❌ Store ' + resourceToStore.substring(0,2));
                const mineralPos = creep.room.memory.mineralStoragePos || { x: 25, y: 25 }; // 默认房间中心
                creep.moveTo(new RoomPosition(mineralPos.x, mineralPos.y, creep.room.name), { visualizePathStyle: { stroke: '#ff0000' }, range: 1 });
                return; // 无法转移，只能移动过去
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
        creep.say('📦 ' + resourceToStore.substring(0,2));
        const result = creep.transfer(target, resourceToStore);
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: resourceToStore === RESOURCE_ENERGY ? '#ffffff' : '#ff00ff' } });
        } else if (result === ERR_FULL) {
            creep.say('⛔ Full');
            // 如果是 Storage 满了，没办法，等待
            // 如果是其他建筑满了，下一 tick storeResources 会重新找目标
        } else if (result !== OK) {
            console.log(`Transfer ${creep.name} 存储 ${resourceToStore} 到 ${target.structureType || 'controller'} 失败: ${result}`);
        }
        // 如果 transfer 成功，下一tick状态检查时，如果没东西了，会自动切换回 collecting
    },

    /**
     * 优先收集非能量资源 (墓碑/掉落物)
     * @param {Creep} creep 
     * @returns {boolean} 是否成功拾取/提取了非能量资源 (如果成功，状态会切换到 working)
     */
    collectNonEnergy: function(creep) {
        // 1. 高优先级：查找包含化合物的坟墓
        const tombstonesWithMinerals = creep.room.find(FIND_TOMBSTONES, {
            filter: tomb => Object.keys(tomb.store).some(r => r !== RESOURCE_ENERGY && tomb.store[r] > 0)
        });
        
        if(tombstonesWithMinerals.length > 0) {
            tombstonesWithMinerals.sort((a, b) => b.ticksToDecay - a.ticksToDecay); // 优先快消失的
            const targetTomb = tombstonesWithMinerals[0];
            let mineralType = Object.keys(targetTomb.store).find(r => r !== RESOURCE_ENERGY && targetTomb.store[r] > 0);
            
            if(mineralType) {
                creep.say('💎' + mineralType.substring(0, 2));
                const result = creep.withdraw(targetTomb, mineralType);
                if(result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetTomb, { visualizePathStyle: { stroke: '#ff00ff' } });
                } else if(result === OK) {
                    creep.memory.working = true; // 立即切换到存储
                    return true;
                }
                return true; // 正在前往或尝试交互，阻止后续能量收集逻辑
            }
        }
        
        // 2. 查找掉落的化合物资源
        const droppedMinerals = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType !== RESOURCE_ENERGY
        });
        
        if(droppedMinerals.length > 0) {
            droppedMinerals.sort((a, b) => b.amount - a.amount);
            const targetMineral = droppedMinerals[0];
            creep.say('💎' + targetMineral.resourceType.substring(0, 2));
            const result = creep.pickup(targetMineral);
            if(result === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetMineral, { visualizePathStyle: { stroke: '#ff00ff' } });
            } else if(result === OK) {
                creep.memory.working = true; // 立即切换到存储
                return true;
            }
            return true; // 正在前往或尝试交互
        }
        
        return false; // 没有找到或处理非能量资源
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
                creep.say('🤝 Helping'); // 更清晰的Say
                return;
            } else {
                // 帮助目标无效或没能量了，清除帮助状态
                // console.log(`${creep.name} 的帮助目标 ${creep.memory.helpingContainerId} 无效或为空，停止帮助`);
                delete creep.memory.helpingContainerId;
                // 继续执行下面的逻辑，可能会重新分配自己的 container 或再次寻找帮助目标
            }
        }

        // 2. 处理自己分配的 Container
        let assignedContainerId = creep.memory.assignedContainerId;
        let container = assignedContainerId ? Game.getObjectById(assignedContainerId) : null;

        // 检查分配的 Container 是否有效
        if (!container) { // 不检查能量是否为0，因为即使为0也可能需要去检查是否该帮助别人
            // 如果 Container 无效，清除分配 (如果之前有分配的话)
            if (assignedContainerId) {
                 this.unassignContainer(creep.room, assignedContainerId);
                 delete creep.memory.assignedContainerId;
                 assignedContainerId = null;
            }
            // console.log(`${creep.name} 的 Container 无效，解除分配`);
        }

        // 3. 如果没有分配的 Container，尝试寻找并分配一个
        if (!assignedContainerId) {
            container = this.findAndAssignContainer(creep, storage);
            if (container) {
                assignedContainerId = container.id; 
                // 分配成功后，直接尝试从新分配的container取货
                 this.withdrawFromTarget(creep, container, '#ffaa00'); // 黄色路径表示前往自己的新目标
                 creep.say('🎯 New C');
                 return;
            } else {
                 // 没有可分配的 Container，在 Storage 附近等待
                this.idleWaitNearStorage(creep, storage, '⏳ No Cont');
                return; 
            }
        }

        // 4. 如果有已分配的有效 Container
        if (container) {
            const currentEnergy = container.store[RESOURCE_ENERGY] || 0;
            
            // 检查能量是否过低，且自己是空的，可以考虑去帮助
            if (currentEnergy < CONTAINER_LOW_ENERGY_THRESHOLD && creep.store.getUsedCapacity() === 0) {
                // console.log(`${creep.name} 的 Container ${assignedContainerId} 能量 (${currentEnergy}) 低，尝试寻找帮助目标`);
                const helpTargetContainer = this.findHelpTarget(creep, storage);
                if (helpTargetContainer) {
                    creep.memory.helpingContainerId = helpTargetContainer.id;
                    // console.log(`${creep.name} 找到帮助目标 ${helpTargetContainer.id}，前往帮助`);
                    this.withdrawFromTarget(creep, helpTargetContainer, '#00ff00'); // 前往帮助目标
                    creep.say('🤝 Go Help'); // 更清晰的Say
                    return;
                } else {
                     // 自己的 Container 能量低，也没找到可帮助的，就在 Storage 附近等待
                     // console.log(`${creep.name} 未找到帮助目标，在 Storage 附近等待`);
                     this.idleWaitNearStorage(creep, storage, '⏳ Idle Low'); // 更清晰的Say
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
                // 如果是帮助目标空了，清除帮助状态
                delete creep.memory.helpingContainerId;
                creep.say('🤝');
            } else if (creep.memory.assignedContainerId === targetContainer.id) {
                 // 如果是自己的 Container 空了，清除分配状态
                 this.unassignContainer(creep.room, targetContainer.id);
                 delete creep.memory.assignedContainerId;
                 creep.say(' C empty');
                 // 此时应该去寻找新的分配或帮助目标
            }
        } else if (result !== OK) {
            console.log(`${creep.name} 从 ${targetContainer.id} withdraw 失败: ${result}`);
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
        
        const unassignedContainers = allContainers.filter(c => 
            !creep.room.memory.assignedContainers.includes(c.id)
        );
        
        if (unassignedContainers.length > 0) {
            const targetContainer = creep.pos.findClosestByPath(unassignedContainers);
            if (targetContainer) {
                creep.memory.assignedContainerId = targetContainer.id;
                creep.room.memory.assignedContainers.push(targetContainer.id);
                return targetContainer;
            } else {
                creep.say('🚧 No Path');
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
            // 选择策略：能量最多的？最近的？
            // 简单起见，选最近的
             return creep.pos.findClosestByPath(potentialTargets);
             // 或者选能量最多的：
             // potentialTargets.sort((a,b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
             // return potentialTargets[0];
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
    idleWaitNearStorage: function(creep, storage, sayMsg = '⏳ Wait') {
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
        else if(gameStage.level >= 4 && energy >= 1200) {
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
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