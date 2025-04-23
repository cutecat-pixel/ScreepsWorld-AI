const utils = require('utils'); // 假设您有一个通用的工具文件

/**
 * Lab 运输者角色模块
 * 负责在 Storage/Terminal 和 Lab 之间运输资源
 */
const roleLabHauler = {
    /**
     * LabHauler 的主要运行逻辑
     * @param {Creep} creep - 要控制的 creep 对象
     */
    run: function(creep) {
        // 如果没有任务，尝试获取一个新任务
        if (!creep.memory.taskId) {
            this.getNewTask(creep);
        }

        // 如果有任务，处理任务
        if (creep.memory.taskId) {
            this.processTask(creep);
        } else {
            // 闲置时可以待在 Storage 附近
            this.idleBehavior(creep);
        }
    },

    /**
     * 为 creep 获取新的 Lab 任务
     * @param {Creep} creep - 需要任务的 creep
     */
    getNewTask: function(creep) {
        if (!creep.room.memory.labTasks || creep.room.memory.labTasks.length === 0) {
            return;
        }

        // 按优先级排序任务 (复制一份)
        const sortedTasks = [...creep.room.memory.labTasks].sort((a, b) => b.priority - a.priority);

        // 寻找未分配的任务
        for (const task of sortedTasks) {
            const taskIndex = creep.room.memory.labTasks.findIndex(t => t.id === task.id);
            if (taskIndex === -1) continue; // 任务已不存在
            
            const originalTask = creep.room.memory.labTasks[taskIndex];

            if (!originalTask.assignee) {
                originalTask.assignee = creep.id;
                creep.memory.taskId = originalTask.id;
                creep.memory.taskType = originalTask.type;
                creep.memory.resourceType = originalTask.resourceType;
                creep.memory.labId = originalTask.labId;
                creep.memory.amount = originalTask.amount;
                creep.memory.collecting = (originalTask.type === 'load'); // 装载任务开始是收集状态，卸载任务开始是运输状态
                creep.say(originalTask.type === 'load' ? '🧪 Load' : '🧪 Unload');
                return;
            }
        }
    },

    /**
     * 处理分配的 Lab 任务
     * @param {Creep} creep - 处理任务的 creep
     */
    processTask: function(creep) {
        const taskId = creep.memory.taskId;
        const taskIndex = creep.room.memory.labTasks.findIndex(t => t.id === taskId);

        if (taskIndex === -1) {
            // 任务已不存在
            this.clearCreepMemory(creep);
            return;
        }

        const task = creep.room.memory.labTasks[taskIndex];
        const lab = Game.getObjectById(creep.memory.labId);
        const resourceType = creep.memory.resourceType;

        if (!lab) {
            // Lab 不存在了
            console.log(`Lab ${creep.memory.labId} 不存在，任务 ${taskId} 无法完成`);
            this.completeTask(creep, taskIndex); // 直接完成（移除）此无效任务
            return;
        }

        // 状态切换
        if (creep.memory.collecting && creep.store.getFreeCapacity() === 0) {
            creep.memory.collecting = false;
            creep.say('🚚 Deliver');
        }
        if (!creep.memory.collecting && creep.store.getUsedCapacity(resourceType) === 0) {
             // 如果是装载任务，并且身上空了，说明一趟运完了（可能没运够，也可能够了）
             if (creep.memory.taskType === 'load') {
                  // 检查任务是否完成（Lab是否满了或接近满）
                 if (lab.store.getFreeCapacity(resourceType) < creep.store.getCapacity() * 0.5) { // Lab 空间不足一半了
                     console.log(`Lab ${lab.id} 装载 ${resourceType} 任务 ${taskId} 完成`);
                      this.completeTask(creep, taskIndex);
                 } else {
                      // 任务没完成，需要继续取货
                      creep.memory.collecting = true;
                      creep.say('🔄 Collect');
                 }
             } else { // 如果是卸载任务，并且身上空了，说明任务完成
                  console.log(`Lab ${lab.id} 卸载 ${resourceType} 任务 ${taskId} 完成`);
                 this.completeTask(creep, taskIndex);
             }
        }


        // 执行动作
        if (creep.memory.collecting) {
            // --- 收集阶段 ---
            if (creep.memory.taskType === 'load') {
                // 装载任务：从 Storage 或 Terminal 取货
                let source = creep.room.storage;
                if (!source || (source.store[resourceType] || 0) === 0) {
                    source = creep.room.terminal;
                }

                if (!source || (source.store[resourceType] || 0) === 0) {
                    console.log(`Creep ${creep.name} 无法找到 ${resourceType} 来执行装载任务 ${taskId}`);
                    // 任务无法完成，可以选择等待或取消
                    // 为了简单，先不取消，让它等待
                    creep.say('❓ Source');
                    return;
                }

                const amountToWithdraw = Math.min(creep.store.getFreeCapacity(), source.store[resourceType]);
                const result = creep.withdraw(source, resourceType, amountToWithdraw);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (result !== OK) {
                     console.log(`Creep ${creep.name} withdraw ${resourceType} from ${source.structureType} failed: ${result}`);
                     // 也许释放任务？
                     // this.unassignTask(creep, taskIndex); this.clearCreepMemory(creep);
                }

            } else { // taskType === 'unload'
                // 卸载任务：从 Lab 取货
                const amountToWithdraw = Math.min(creep.store.getFreeCapacity(), lab.store[resourceType]);
                const result = creep.withdraw(lab, resourceType, amountToWithdraw);
                 if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(lab, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (result !== OK) {
                     console.log(`Creep ${creep.name} withdraw ${resourceType} from Lab ${lab.id} failed: ${result}`);
                     // 如果Lab是空的，任务可以完成了
                     if(result === ERR_NOT_ENOUGH_RESOURCES) {
                         this.completeTask(creep, taskIndex);
                     }
                }
            }
        } else {
            // --- 运输/卸货阶段 ---
             if (creep.memory.taskType === 'load') {
                 // 装载任务：将资源送到 Lab
                 const result = creep.transfer(lab, resourceType);
                 if (result === ERR_NOT_IN_RANGE) {
                     creep.moveTo(lab, { visualizePathStyle: { stroke: '#ffffff' } });
                 } else if (result === ERR_FULL) {
                      console.log(`Lab ${lab.id} 已满，无法继续装载 ${resourceType} (任务 ${taskId})`);
                     this.completeTask(creep, taskIndex);
                 } else if (result !== OK) {
                     console.log(`Creep ${creep.name} transfer ${resourceType} to Lab ${lab.id} failed: ${result}`);
                 }
             } else { // taskType === 'unload'
                 // 卸载任务：将资源送到 Storage 或 Terminal
                let target = creep.room.storage;
                if (!target || target.store.getFreeCapacity() === 0) {
                    target = creep.room.terminal;
                }

                if (!target) {
                    console.log(`Creep ${creep.name} 无法找到地方卸载 ${resourceType} (任务 ${taskId})`);
                    creep.say('❓ Target');
                    return;
                }
                
                 const result = creep.transfer(target, resourceType);
                 if (result === ERR_NOT_IN_RANGE) {
                     creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                 } else if (result === ERR_FULL) {
                     console.log(`${target.structureType} 已满，无法接收 ${resourceType} (任务 ${taskId})`);
                     // 尝试换个目标？ 如果另一个也满了，任务就卡住了
                     if (target === creep.room.storage && creep.room.terminal && creep.room.terminal.store.getFreeCapacity() > 0) {
                         target = creep.room.terminal; // 切换到 terminal
                         if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
                              creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                         }
                     } else {
                         // 两个都满了，或者没有Terminal
                         creep.say('⛔ Full');
                         // 任务无法完成，等待
                     }
                 } else if (result !== OK) {
                      console.log(`Creep ${creep.name} transfer ${resourceType} to ${target.structureType} failed: ${result}`);
                 }
             }
        }
    },

    /**
     * 完成任务：从任务列表中移除任务并清理 creep 内存
     */
    completeTask: function(creep, taskIndex) {
        if (taskIndex !== -1 && creep.room.memory.labTasks && creep.room.memory.labTasks[taskIndex]) {
            creep.room.memory.labTasks.splice(taskIndex, 1);
        }
        this.clearCreepMemory(creep);
        creep.say('✓ Done');
    },

    /**
     * 清除 creep 的任务相关内存
     */
    clearCreepMemory: function(creep) {
        delete creep.memory.taskId;
        delete creep.memory.taskType;
        delete creep.memory.resourceType;
        delete creep.memory.labId;
        delete creep.memory.amount;
        delete creep.memory.collecting;
    },
    
    /**
     * 释放任务分配 (如果需要)
     */
    unassignTask: function(creep, taskIndex) {
         if (taskIndex !== -1 && creep.room.memory.labTasks && creep.room.memory.labTasks[taskIndex]) {
             const task = creep.room.memory.labTasks[taskIndex];
             if (task.assignee === creep.id) {
                 delete task.assignee;
             }
         }
     },

    /**
     * 闲置行为
     */
    idleBehavior: function(creep) {
        // 如果身上有东西，存回 Storage/Terminal
        if (creep.store.getUsedCapacity() > 0) {
             let target = creep.room.storage || creep.room.terminal;
             if (target) {
                 for (const resourceType in creep.store) {
                     if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
                         creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                         return;
                     }
                 }
             }
        } else {
            // 移动到 Storage 附近等待
            const storage = creep.room.storage;
            if (storage && !creep.pos.isNearTo(storage)) {
                 creep.moveTo(storage, { visualizePathStyle: { stroke: '#cccccc' }, range: 1 });
            } else {
                 creep.say('🕒 Idle');
            }
        }
    },

    /**
     * 根据可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy) {
        // Lab Hauler 不需要太大，但需要 CARRY 和 MOVE
        // 示例：目标是平衡 CARRY 和 MOVE
        let body = [];
        const maxParts = 50;
        let currentEnergy = energy;
        let carryParts = 0;
        let moveParts = 0;

        while (currentEnergy >= 100 && body.length < maxParts - 1) {
            if (currentEnergy >= 100) {
                body.push(CARRY, MOVE);
                carryParts++;
                moveParts++;
                currentEnergy -= 100;
            } else {
                break;
            }
        }
         // 补齐剩余能量
         if (currentEnergy >= 50 && body.length < maxParts) {
             // 优先加 CARRY 还是 MOVE 取决于需求，这里简单加 CARRY
             body.push(CARRY);
             carryParts++;
             currentEnergy -= 50;
         }

        if (body.length === 0) {
            body = [CARRY, MOVE]; // 最小配置
        }

        return body;
    }
};

module.exports = roleLabHauler; 