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
        
        // 按优先级排序任务
        const tasks = creep.room.memory.terminalTasks.sort((a, b) => b.priority - a.priority);
        
        // 寻找未分配或高优先级的任务
        for(let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            
            // 检查任务是否已分配
            let isAssigned = false;
            for(const name in Game.creeps) {
                const otherCreep = Game.creeps[name];
                if(otherCreep.id !== creep.id && 
                   otherCreep.memory.taskId === task.id) {
                    isAssigned = true;
                    break;
                }
            }
            
            // 如果任务未分配，分配给当前creep
            if(!isAssigned) {
                creep.memory.taskId = task.id;
                creep.memory.taskType = task.type;
                creep.memory.taskResource = task.resource;
                creep.memory.taskAmount = task.amount;
                creep.memory.taskFrom = task.from;
                creep.memory.taskTo = task.to;
                creep.say('📦');
                console.log(`Creep ${creep.name} 接受了终端任务 ${task.id}`);
                return;
            }
        }
    },
    
    /**
     * 处理分配的终端任务
     * @param {Creep} creep - 处理任务的creep
     */
    processTask: function(creep) {
        // 获取任务详情
        const taskId = creep.memory.taskId;
        const taskType = creep.memory.taskType;
        const resource = creep.memory.taskResource;
        const amount = creep.memory.taskAmount;
        const fromType = creep.memory.taskFrom;
        const toType = creep.memory.taskTo;
        
        // 验证任务是否还存在
        if(!creep.room.memory.terminalTasks) {
            delete creep.memory.taskId;
            delete creep.memory.taskType;
            delete creep.memory.taskResource;
            delete creep.memory.taskAmount;
            delete creep.memory.taskFrom;
            delete creep.memory.taskTo;
            return;
        }
        
        const taskIndex = creep.room.memory.terminalTasks.findIndex(t => t.id === taskId);
        if(taskIndex === -1) {
            // 任务不存在，清除记忆
            delete creep.memory.taskId;
            delete creep.memory.taskType;
            delete creep.memory.taskResource;
            delete creep.memory.taskAmount;
            delete creep.memory.taskFrom;
            delete creep.memory.taskTo;
            return;
        }
        
        // 根据任务类型执行不同的操作
        if(taskType === 'transfer') {
            this.handleTransferTask(creep, resource, amount, fromType, toType, taskId, taskIndex);
        } else {
            // 未知任务类型，清除任务
            console.log(`Creep ${creep.name} 收到未知类型的任务: ${taskType}`);
            this.completeTask(creep, taskIndex);
        }
    },
    
    /**
     * 处理资源转移任务
     */
    handleTransferTask: function(creep, resource, amount, fromType, toType, taskId, taskIndex) {
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
            console.log(`Creep ${creep.name} 无法完成任务，来源或目标结构不存在`);
            this.completeTask(creep, taskIndex);
            return;
        }
        
        // 检查来源结构中是否有足够资源
        const availableResource = fromStructure.store[resource] || 0;
        if(availableResource === 0) {
            console.log(`Creep ${creep.name} 无法完成任务，${fromType}中没有${resource}`);
            this.completeTask(creep, taskIndex);
            return;
        }
        
        // 检查creep是否已满或为空
        const creepEmpty = creep.store.getUsedCapacity() === 0;
        const creepFull = creep.store.getFreeCapacity() === 0;
        
        // 如果creep为空，从来源获取资源
        if(creepEmpty) {
            // 计算要取的数量：任务数量和creep容量中的较小值
            const amountToWithdraw = Math.min(amount, creep.store.getFreeCapacity(), availableResource);
            
            // 从结构中获取资源
            if(creep.withdraw(fromStructure, resource, amountToWithdraw) === ERR_NOT_IN_RANGE) {
                creep.moveTo(fromStructure, {visualizePathStyle: {stroke: '#ffaa00'}});
                creep.say('🚚');
            }
        }
        // 如果creep已满或携带了一些资源，转移到目标
        else {
            // 获取creep携带的任务资源数量
            const carriedAmount = creep.store[resource] || 0;
            
            // 如果creep没有携带任务资源但携带了其他资源，先把其他资源放入storage
            if(carriedAmount === 0 && !creepEmpty) {
                const storage = creep.room.storage;
                if(storage) {
                    for(const resourceType in creep.store) {
                        if(creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
                            break;
                        }
                    }
                }
                return;
            }
            
            // 将资源转移到目标
            if(creep.transfer(toStructure, resource) === ERR_NOT_IN_RANGE) {
                creep.moveTo(toStructure, {visualizePathStyle: {stroke: '#ffffff'}});
                creep.say('📦');
            } else {
                // 更新剩余任务量
                creep.room.memory.terminalTasks[taskIndex].amount -= carriedAmount;
                
                // 如果任务完成，从列表中移除
                if(creep.room.memory.terminalTasks[taskIndex].amount <= 0) {
                    this.completeTask(creep, taskIndex);
                } else {
                    // 任务未完成，继续处理
                    delete creep.memory.taskId;
                    delete creep.memory.taskType;
                    delete creep.memory.taskResource;
                    delete creep.memory.taskAmount;
                    delete creep.memory.taskFrom;
                    delete creep.memory.taskTo;
                }
            }
        }
    },
    
    /**
     * 完成任务并清理内存
     */
    completeTask: function(creep, taskIndex) {
        // 从任务列表中移除任务
        creep.room.memory.terminalTasks.splice(taskIndex, 1);
        
        // 清除creep的任务记忆
        delete creep.memory.taskId;
        delete creep.memory.taskType;
        delete creep.memory.taskResource;
        delete creep.memory.taskAmount;
        delete creep.memory.taskFrom;
        delete creep.memory.taskTo;
        
        creep.say('✓');
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
        
        if(gameStage.level >= 6 && energy >= 550) {
            // 基础配置
            body = [
                CARRY, CARRY, CARRY, CARRY, CARRY, 
                MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else {
            // 最小配置
            body = [CARRY, CARRY, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleTerminalHauler; 