/**
 * 终端运输者角色模块
 * 负责处理终端相关的物流任务，包括从Storage向Terminal运输资源和能量
 */
const roleTerminalHauler = {
    /**
     * 终端运输者的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 如果没有目标任务，获取一个新任务
        if(!creep.memory.taskId) {
            this.getNewTask(creep);
        }
        
        // 如果有任务，处理任务
        if(creep.memory.taskId) {
            this.processTask(creep);
        } else {
            // 闲置时移动到终端附近等待
            const terminal = creep.room.terminal;
            if(terminal) {
                if(creep.pos.getRangeTo(terminal) > 3) {
                    creep.moveTo(terminal, {visualizePathStyle: {stroke: '#ffffff'}, range: 3});
                }
                creep.say('⏳');
            } else {
                // 如果房间没有终端，默认行为
                this.idleBehavior(creep);
            }
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
                creep.say('✅ New Task');
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
                creep.say('🚚 Pickup');
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
                    creep.say('📦 Deliver');
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
        creep.say('✓ Done');
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
     * 闲置行为
     */
    idleBehavior: function(creep) {
        // 如果creep携带资源，将资源存入storage
        if(creep.store.getUsedCapacity() > 0) {
            const storage = creep.room.storage;
            if(storage) {
                for(const resourceType in creep.store) {
                    if(creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
                        break;
                    }
                }
            } else {
                // 如果没有storage，移动到房间中心等待
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    range: 5
                });
            }
        } else {
            // 如果没有任何资源，移动到房间中心等待
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                visualizePathStyle: {stroke: '#ffaa00'},
                range: 5
            });
        }
        
        creep.say('🕒');
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