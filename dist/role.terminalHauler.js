/**
 * 终端运输者角色模块
 * 负责处理终端相关的物流任务，包括从Storage向Terminal运输资源和能量
 * 以及管理STORAGE和CONTROLLER附近的LINK能量传输
 */
const roleTerminalHauler = {
    /**
     * 终端运输者的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        
        // 优先检查并处理LINK能量任务
        if(this.checkAndHandleLinkEnergy(creep)) {
            // 如果正在处理LINK任务，则本tick结束
            return;
        }
        
        // 如果没有目标任务，且不在处理LINK任务，获取一个新任务
        if(!creep.memory.taskId && !creep.memory.linkEnergyTask) { 
            this.getNewTask(creep);
        }
        
        // 如果有终端任务，处理任务
        if(creep.memory.taskId) {
            this.processTask(creep);
        } 
        // 如果没有终端任务，且没有LINK任务，执行闲置逻辑
        else if (!creep.memory.linkEnergyTask) {
            this.idleBehavior(creep);
        } else {
            // 正在处理LINK任务相关的移动或等待，但checkAndHandleLinkEnergy返回false
            // (例如：刚存完货，等待下一轮检查)
            creep.say('🔗 Idle');
        }
    },
    
    /**
     * 为creep获取新的终端任务
     * @param {Creep} creep - 需要任务的creep
     */
    getNewTask: function(creep) {
        // 检查房间是否有终端任务
        if(!creep.room.memory.terminalTasks || creep.room.memory.terminalTasks.length === 0) {
            return;
        }
        
        // 按优先级排序任务 (复制一份以防修改影响原始数组的迭代)
        const sortedTasks = [...creep.room.memory.terminalTasks].sort((a, b) => b.priority - a.priority);
        
        // 寻找未分配或高优先级的任务
        for(const task of sortedTasks) {
            // 在原始任务列表中找到该任务的索引
            const taskIndex = creep.room.memory.terminalTasks.findIndex(t => t.id === task.id);
            if (taskIndex === -1) continue; // 任务可能在此期间被完成或删除
            
            const originalTask = creep.room.memory.terminalTasks[taskIndex];
            
            // 检查任务是否已分配
            if(originalTask.assignee === undefined || originalTask.assignee === null) {
                // 尝试分配任务
                originalTask.assignee = creep.id;
                
                // 设置creep的记忆
                creep.memory.taskId = originalTask.id;
                creep.memory.taskType = originalTask.type;
                creep.memory.taskResource = originalTask.resource;
                creep.memory.taskAmount = originalTask.amount; // 记录最初需要处理的总量
                creep.memory.taskFrom = originalTask.from;
                creep.memory.taskTo = originalTask.to;
                creep.say('✅');
                // console.log(`Creep ${creep.name} 接受了终端任务 ${originalTask.id}`);
                return; // 找到任务，退出循环
            }
        }
    },
    
    /**
     * 处理分配的终端任务
     * @param {Creep} creep - 处理任务的creep
     */
    processTask: function(creep) {
        // 获取任务ID
        const taskId = creep.memory.taskId;
        
        // 验证任务是否还存在于房间内存中
        if(!creep.room.memory.terminalTasks) {
            this.clearCreepMemory(creep);
            return;
        }
        
        const taskIndex = creep.room.memory.terminalTasks.findIndex(t => t.id === taskId);
        if(taskIndex === -1) {
            // 任务不存在，清除记忆
            // console.log(`任务 ${taskId} 已不存在，清除 Creep ${creep.name} 记忆`);
            this.clearCreepMemory(creep);
            return;
        }
        
        // 获取最新的任务对象
        const task = creep.room.memory.terminalTasks[taskIndex];
        
        // 验证任务是否仍分配给此creep
        if (task.assignee !== creep.id) {
            console.log(`任务 ${taskId} 不再分配给 Creep ${creep.name} (当前分配给: ${task.assignee})，清除记忆`);
            this.clearCreepMemory(creep);
            return;
        }
        
        // 获取任务详情 (使用最新的task对象中的amount)
        const taskType = task.type; // creep.memory.taskType 理论上和 task.type 一致
        const resource = task.resource; // creep.memory.taskResource
        const amount = task.amount; // 这是剩余量，creep.memory.amount 是初始量
        const fromType = task.from; // creep.memory.taskFrom
        const toType = task.to; // creep.memory.taskTo
        
        // 根据任务类型执行不同的操作
        if(taskType === 'transfer') {
            this.handleTransferTask(creep, task, taskIndex);
        } else {
            // 未知任务类型，清除任务
            console.log(`Creep ${creep.name} 收到未知类型的任务: ${taskType}`);
            this.completeTask(creep, taskIndex); // 完成任务（从列表移除）
        }
    },
    
    /**
     * 处理资源转移任务
     * @param {Creep} creep
     * @param {object} task - 内存中的任务对象 {id, type, resource, amount, from, to, priority, assignee}
     * @param {number} taskIndex - 任务在内存数组中的索引
     */
    handleTransferTask: function(creep, task, taskIndex) {
        const resource = task.resource;
        const amount = task.amount; // 剩余需要转移的数量
        const fromType = task.from;
        const toType = task.to;
        
        // 获取来源和目标结构
        let fromStructure = null;
        let toStructure = null;
        
        if(fromType === 'storage') {
            fromStructure = creep.room.storage;
        } else if(fromType === 'terminal') {
            fromStructure = creep.room.terminal;
        }
        
        if(toType === 'storage') {
            toStructure = creep.room.storage;
        } else if(toType === 'terminal') {
            toStructure = creep.room.terminal;
        }
        
        // 验证结构是否存在
        if(!fromStructure || !toStructure) {
            console.log(`Creep ${creep.name} 无法完成任务 ${task.id}，来源(${fromType})或目标(${toType})结构不存在`);
            this.unassignTask(creep, taskIndex); // 释放任务分配
            this.clearCreepMemory(creep); // 清除creep记忆
            // 考虑是否应该直接完成（删除）这个无效任务
            // this.completeTask(creep, taskIndex); 
            return;
        }
        
        // 检查creep是否已满或为空
        const creepEmpty = creep.store.getUsedCapacity() === 0;
        const creepFull = creep.store.getFreeCapacity() === 0;
        
        // 如果creep为空，从来源获取资源
        if(creepEmpty) {
            // 检查来源结构中是否有任务所需的资源
            const availableResource = fromStructure.store[resource] || 0;
            if(availableResource === 0) {
                // 资源已经没了，任务无法继续（至少现在不行）
                console.log(`Creep ${creep.name} 无法执行任务 ${task.id}，来源 ${fromType} 中已没有 ${resource}`);
                // 如果任务需求量也为0或负数，说明任务可能已完成但未清理，直接完成它
                if (amount <= 0) {
                    this.completeTask(creep, taskIndex);
                } else {
                    // 否则只是暂时没资源，释放任务让其他creep或之后再试
                    this.unassignTask(creep, taskIndex);
                    this.clearCreepMemory(creep);
                }
                return;
            }
            
            // 计算要取的数量：任务剩余数量、creep容量、来源可用量三者中的较小值
            const amountToWithdraw = Math.min(amount, creep.store.getFreeCapacity(), availableResource);
            
            // 从结构中获取资源
            const result = creep.withdraw(fromStructure, resource, amountToWithdraw);
            if(result === ERR_NOT_IN_RANGE) {
                creep.moveTo(fromStructure, {visualizePathStyle: {stroke: '#ffaa00'}});
                creep.say('🚚');
            } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
                // 刚检查还有，现在没了？可能是并发问题或计算错误
                console.log(`Creep ${creep.name} withdraw ${resource} from ${fromType} failed: ERR_NOT_ENOUGH_RESOURCES (Race condition?)`);
                this.unassignTask(creep, taskIndex); // 释放任务
                this.clearCreepMemory(creep);
            } else if (result !== OK) {
                console.log(`Creep ${creep.name} withdraw ${resource} from ${fromType} failed with code: ${result}`);
                this.unassignTask(creep, taskIndex); // 释放任务
                this.clearCreepMemory(creep);
            }
            // 如果withdraw成功 (result === OK)，creep 不再为空，下一tick会进入else分支去transfer
        }
        // 如果creep不为空，转移到目标
        else {
            // 获取creep携带的任务资源数量
            const carriedAmount = creep.store[resource] || 0;
            
            // 如果creep没有携带任务资源但携带了其他资源，先把其他资源放入storage
            if(carriedAmount === 0 && !creepEmpty) {
                const storage = creep.room.storage;
                if(storage) {
                    // 尝试清空非任务资源
                    let transferred = false;
                    for(const resourceType in creep.store) {
                        if(creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
                            transferred = true; // 标记正在移动以清空
                            break;
                        }
                        transferred = true; // 标记已尝试转移（即使失败也要等下一tick）
                    }
                    if (transferred) return; // 等待清空完成
                } else {
                    // 没有storage无法清空，可能导致问题，先记录日志
                    console.log(`Creep ${creep.name} has non-task resources but no Storage to deposit.`);
                    // 也许应该取消任务？
                    this.unassignTask(creep, taskIndex);
                    this.clearCreepMemory(creep);
                    return;
                }
            }
            
            // 确保携带了需要转移的资源才去目标
            if (carriedAmount > 0) {
                // 将资源转移到目标
                const result = creep.transfer(toStructure, resource);
                if(result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(toStructure, {visualizePathStyle: {stroke: '#ffffff'}});
                    creep.say('📦');
                } else if (result === ERR_FULL) {
                    // 目标满了，无法完成转移
                    console.log(`Creep ${creep.name} transfer ${resource} to ${toType} failed: ERR_FULL`);
                    // 释放任务，让系统重新评估，或者等待
                    // 可以选择等待一会，或者尝试把资源放回storage？
                    // 简单起见，先释放任务
                    this.unassignTask(creep, taskIndex);
                    this.clearCreepMemory(creep);
                } else if (result === OK) {
                    // 转移成功
                    // 更新任务剩余量 (直接修改内存中的task对象)
                    // 注意：carriedAmount 是 transfer 调用前creep携带的数量，这正好是成功转移的数量
                    task.amount -= carriedAmount; 
                    
                    // console.log(`Creep ${creep.name} transferred ${carriedAmount} ${resource} to ${toType}. Task ${task.id} remaining: ${task.amount}`);
                    
                    // 如果任务完成 (剩余量 <= 0)，从列表中移除并清理creep内存
                    if(task.amount <= 0) {
                        // console.log(`Task ${task.id} completed by ${creep.name}`);
                        this.completeTask(creep, taskIndex);
                    } else {
                        // 任务未完成，需要继续（可能是下一趟）
                        // 释放任务分配，清除creep当前任务记忆，让它下一tick重新获取任务
                        // 这样可以响应更高优先级的任务
                        // console.log(`Task ${task.id} not complete, releasing assignment from ${creep.name}`);
                        this.unassignTask(creep, taskIndex);
                        this.clearCreepMemory(creep);
                    }
                } else {
                    // 其他转移错误
                    console.log(`Creep ${creep.name} transfer ${resource} to ${toType} failed with code: ${result}`);
                    this.unassignTask(creep, taskIndex); // 释放任务
                    this.clearCreepMemory(creep);
                }
            } else {
                // 身上没有任务资源（可能在清空其他资源时出错了），重置状态
                this.clearCreepMemory(creep); 
            }
        }
    },
    
    /**
     * 完成任务：从任务列表中移除任务并清理creep内存
     * @param {Creep} creep
     * @param {number} taskIndex - 任务在内存数组中的索引
     */
    completeTask: function(creep, taskIndex) {
        // 验证taskIndex有效性
        if (taskIndex !== -1 && creep.room.memory.terminalTasks && creep.room.memory.terminalTasks[taskIndex]) {
            // const taskId = creep.room.memory.terminalTasks[taskIndex].id;
            // console.log(`Completing task ${taskId} at index ${taskIndex}`);
            // 从任务列表中移除任务
            creep.room.memory.terminalTasks.splice(taskIndex, 1);
        } else {
            // console.log(`Warning: Task index ${taskIndex} invalid or task already removed when trying to complete.`);
        }
        
        // 清除creep的任务记忆
        this.clearCreepMemory(creep);
        creep.say('✓');
    },
    
    /**
     * 清除creep的任务相关内存
     * @param {Creep} creep 
     */
    clearCreepMemory: function(creep) {
        delete creep.memory.taskId;
        delete creep.memory.taskType;
        delete creep.memory.taskResource;
        delete creep.memory.taskAmount;
        delete creep.memory.taskFrom;
        delete creep.memory.taskTo;
    },
    
    /**
     * 从内存中的任务对象上移除对此creep的分配标记
     * @param {Creep} creep
     * @param {number} taskIndex - 任务在内存数组中的索引
     */
    unassignTask: function(creep, taskIndex) {
        if (taskIndex !== -1 && creep.room.memory.terminalTasks && creep.room.memory.terminalTasks[taskIndex]) {
            const task = creep.room.memory.terminalTasks[taskIndex];
            // 仅当任务当前确实分配给此creep时才取消分配
            if (task.assignee === creep.id) {
                delete task.assignee;
                // console.log(`Unassigned task ${task.id} from creep ${creep.id}`);
            }
        }
    },
    
    /**
     * 闲置行为 (清理了旧的link处理逻辑)
     */
    idleBehavior: function(creep) {
        // 如果creep携带资源，将资源存入storage
        if(creep.store.getUsedCapacity() > 0) {
            this.depositToStorage(creep); // 使用辅助函数清空
            return;
        }
        
        // 如果空闲且空载，移动到Terminal或Storage附近
        const target = creep.room.terminal || creep.room.storage;
        if (target) {
            if (!creep.pos.inRangeTo(target, 3)) {
                 creep.moveTo(target, { visualizePathStyle: { stroke: '#cccccc' }, range: 3 });
            }
        } else {
            // Fallback: move to center if no terminal/storage
             creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                 visualizePathStyle: { stroke: '#cccccc' },
                 range: 5
             });
        }
        creep.say('🕒');
    },
    
    /**
     * 检查并处理LINK能量任务 (重构逻辑)
     * @param {Creep} creep - 要检查的creep
     * @returns {boolean} - 如果creep正在积极处理LINK能量任务返回true
     */
    checkAndHandleLinkEnergy: function(creep) {
        // 检查基本条件
        if (!creep.room.storage || !creep.room.memory.links || !creep.room.memory.links.storage || creep.room.controller.level < 5) {
            delete creep.memory.linkEnergyTask; // 清理任务状态
            return false;
        }
    
        const storageLink = Game.getObjectById(creep.room.memory.links.storage);
        const controllerLink = Game.getObjectById(creep.room.memory.links.controller); // 可能不存在
        const storage = creep.room.storage;
    
        if (!storageLink) {
            delete creep.memory.linkEnergyTask;
            return false;
        }
    
        // 决定目标模式：填充Storage Link还是清空Storage Link
        let fillStorageLinkMode = false;
        // 仅当房间LINK传输开启时，才检查Controller Link是否需要能量
        const linkTransferEnabled = creep.room.memory.links.enabled !== false;
        const controllerLinkNeedsEnergy = linkTransferEnabled && controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < 200;
        const storageLinkHasSpace = storageLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        
        if (controllerLinkNeedsEnergy && storageLinkHasSpace) {
            fillStorageLinkMode = true;
        }
    
        // --- 状态切换与任务设置 --- 
        const currentTask = creep.memory.linkEnergyTask;
        let newTask = null;
        
        if (fillStorageLinkMode && currentTask !== 'TO_STORAGE_LINK') {
            // 需要填充，但当前任务不是填充或未设置
            if (creep.store.getUsedCapacity() > 0) { // 先清空自己
                this.depositToStorage(creep);
                return true; // 正在清空，下tick再切换任务
            }
            newTask = 'TO_STORAGE_LINK';
        } else if (!fillStorageLinkMode && storageLink.store.getUsedCapacity(RESOURCE_ENERGY) > 50 && currentTask !== 'TO_STORAGE') {
            // 需要清空，但当前任务不是清空或未设置
            if (creep.store.getUsedCapacity() > 0) { // 先清空自己
                this.depositToStorage(creep);
                return true; // 正在清空，下tick再切换任务
            }
            newTask = 'TO_STORAGE';
        } else if (!fillStorageLinkMode && storageLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 50 && currentTask === 'TO_STORAGE') {
            // 正在清空，但目标Link已空，结束任务
            delete creep.memory.linkEnergyTask;
            return false;
        } else if (fillStorageLinkMode && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) === 0 && currentTask === 'TO_STORAGE_LINK') {
            // 正在填充，但目标Link已满，结束任务
            delete creep.memory.linkEnergyTask;
            return false;
        }
        
        // 如果需要切换任务
        if (newTask) {
            // console.log(`${creep.name}: Switching Link Task to ${newTask}`);
            creep.memory.linkEnergyTask = newTask;
            delete creep.memory._move; // 重置移动缓存
        }
        
        // --- 执行当前任务 --- 
        const taskToExecute = creep.memory.linkEnergyTask;
        
        if (taskToExecute === 'TO_STORAGE_LINK') { // 填充模式
            creep.say('🔗⬆️S');
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                // 从 Storage 取货
                if (storage.store[RESOURCE_ENERGY] === 0) { delete creep.memory.linkEnergyTask; return false; } // Storage没货了
                const result = creep.withdraw(storage, RESOURCE_ENERGY);
                if (result === ERR_NOT_IN_RANGE) creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
                else if (result !== OK) { console.log(`${creep.name} LinkTask Error withdraw Stor: ${result}`); delete creep.memory.linkEnergyTask; }
            } else {
                // 向 Storage Link 送货
                const result = creep.transfer(storageLink, RESOURCE_ENERGY);
                if (result === ERR_NOT_IN_RANGE) creep.moveTo(storageLink, { visualizePathStyle: { stroke: '#ffffff' } });
                else if (result === ERR_FULL) { delete creep.memory.linkEnergyTask; } // Link满了，任务完成
                else if (result !== OK) { console.log(`${creep.name} LinkTask Error transfer SL: ${result}`); delete creep.memory.linkEnergyTask; }
            }
            return true; // 正在执行任务
            
        } else if (taskToExecute === 'TO_STORAGE') { // 清空模式
            creep.say('🔗⬇️S');
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                // 从 Storage Link 取货
                if (storageLink.store[RESOURCE_ENERGY] === 0) { delete creep.memory.linkEnergyTask; return false; } // Link没货了
                const result = creep.withdraw(storageLink, RESOURCE_ENERGY);
                if (result === ERR_NOT_IN_RANGE) creep.moveTo(storageLink, { visualizePathStyle: { stroke: '#ffaa00' } });
                else if (result !== OK) { console.log(`${creep.name} LinkTask Error withdraw SL: ${result}`); delete creep.memory.linkEnergyTask; }
            } else {
                // 向 Storage 送货
                const result = creep.transfer(storage, RESOURCE_ENERGY);
                if (result === ERR_NOT_IN_RANGE) creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
                else if (result === ERR_FULL) { creep.say('⛔ Strg'); delete creep.memory.linkEnergyTask; } // Storage满了，任务中断
                else if (result !== OK) { console.log(`${creep.name} LinkTask Error transfer Stor: ${result}`); delete creep.memory.linkEnergyTask; }
            }
            return true; // 正在执行任务
        }
        
        return false; // 没有Link任务在执行
    },

    /**
     * 辅助函数：清空Creep身上的所有资源到Storage
     * @param {Creep} creep 
     */
    depositToStorage: function(creep) {
        const storage = creep.room.storage;
        if (!storage) return; // 无处存放
    
        for(const resourceType in creep.store) {
            if (creep.store[resourceType] > 0) {
                 const result = creep.transfer(storage, resourceType);
                 if (result === ERR_NOT_IN_RANGE) {
                     creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' }, range: 1 });
                     creep.say('🧹');
                     return; // 优先移动
                 } else if (result === OK) {
                     // 成功转移一种，下一tick继续转移其他的（如果还有）
                     return;
                 } else {
                     // 其他错误 (如满了)，也等下一tick
                     creep.say('⛔');
                     return;
                 }
            }
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
        
        // 身体部件应根据 carry 能力和 terminal/storage 距离优化
        // 这里使用之前的配置作为示例
        if(gameStage.level >= 6 && energy >= 550) {
            // 示例: 10 CARRY, 5 MOVE = 10*50 + 5*50 = 750 energy
            // 调整为 6 CARRY, 3 MOVE = 6*50 + 3*50 = 450 energy
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        else {
            // 最小配置: 2 CARRY, 1 MOVE = 2*50 + 1*50 = 150 energy
            body = [CARRY, CARRY, MOVE];
        }

        return body;
    }
};

module.exports = roleTerminalHauler; 